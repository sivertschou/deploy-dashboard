import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { vpsDb } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const vps = vpsDb.findById(parseInt(id));

    if (!vps) {
      return NextResponse.json(
        { error: 'VPS not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ vps });
  } catch (error) {
    console.error('Error fetching VPS:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    vpsDb.delete(parseInt(id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting VPS:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
