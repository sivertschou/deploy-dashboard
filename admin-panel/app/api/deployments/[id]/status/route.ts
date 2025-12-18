import { NextRequest, NextResponse } from 'next/server';
import { verifyVpsApiKey } from '@/lib/auth';
import { deploymentDb, deploymentLogDb } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKeyResult = verifyVpsApiKey(request);
  if (apiKeyResult instanceof NextResponse) return apiKeyResult;

  try {
    const { id } = await params;
    const body = await request.json();
    const { status, logs } = body;

    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      );
    }

    deploymentDb.updateStatus(parseInt(id), status);

    if (logs && Array.isArray(logs)) {
      for (const log of logs) {
        deploymentLogDb.create(
          parseInt(id),
          log.level || 'info',
          log.message
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating deployment status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
