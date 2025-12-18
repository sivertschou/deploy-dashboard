import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, verifyDeployApiKey } from '@/lib/auth';
import { vpsDb, deploymentDb, deploymentLogDb } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = request.headers.get('authorization');

  let isAuthenticated = false;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const apiKeyResult = verifyDeployApiKey(request);
    if (apiKeyResult === true) {
      isAuthenticated = true;
    } else if (apiKeyResult instanceof NextResponse) {
      return apiKeyResult;
    }
  }

  if (!isAuthenticated) {
    const sessionAuth = await requireAuth(request);
    if (sessionAuth instanceof NextResponse) return sessionAuth;
  }

  try {
    const { id } = await params;
    const vps = vpsDb.findById(parseInt(id));

    if (!vps) {
      return NextResponse.json(
        { error: 'VPS not found' },
        { status: 404 }
      );
    }

    if (vps.status !== 'online') {
      return NextResponse.json(
        { error: 'VPS is not online' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, dockerCompose, envVars } = body;

    if (!name || !dockerCompose) {
      return NextResponse.json(
        { error: 'Name and docker-compose configuration are required' },
        { status: 400 }
      );
    }

    const deploymentId = deploymentDb.create(
      parseInt(id),
      name,
      dockerCompose,
      envVars ? JSON.stringify(envVars) : undefined
    );

    deploymentLogDb.create(Number(deploymentId), 'info', 'Deployment created');

    try {
      const agentResponse = await fetch(`http://${vps.ip_address}:9090/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${vps.api_key}`,
        },
        body: JSON.stringify({
          deploymentId: Number(deploymentId),
          name,
          dockerCompose,
          envVars: envVars || {},
        }),
      });

      if (!agentResponse.ok) {
        throw new Error(`Agent returned status ${agentResponse.status}`);
      }

      const result = await agentResponse.json();

      deploymentLogDb.create(Number(deploymentId), 'info', 'Deployment sent to agent');
      deploymentDb.updateStatus(Number(deploymentId), 'deploying');

      return NextResponse.json({
        success: true,
        deploymentId: Number(deploymentId),
        message: result.message || 'Deployment initiated',
      });
    } catch (error: any) {
      deploymentLogDb.create(Number(deploymentId), 'error', `Failed to contact agent: ${error.message}`);
      deploymentDb.updateStatus(Number(deploymentId), 'failed');

      return NextResponse.json(
        { error: 'Failed to contact VPS agent', details: error.message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error creating deployment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
