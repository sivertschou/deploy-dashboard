import { NextRequest, NextResponse } from 'next/server';
import { verifyVpsApiKey } from '@/lib/auth';
import { vpsDb } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKeyResult = verifyVpsApiKey(request);
  if (apiKeyResult instanceof NextResponse) return apiKeyResult;

  try {
    const { id } = await params;
    const body = await request.json();
    const { status, cpuUsage, memoryUsage, diskUsage, containers } = body;

    vpsDb.updateStatus(
      parseInt(id),
      status || 'online',
      cpuUsage || 0,
      memoryUsage || 0,
      diskUsage || 0
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating VPS status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
