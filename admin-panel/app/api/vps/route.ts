import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { vpsDb } from '@/lib/db';
import { generateApiKey } from '@/lib/crypto';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const vpsList = vpsDb.findAll();
    return NextResponse.json({ vpsList });
  } catch (error) {
    console.error('Error fetching VPS list:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { name, ipAddress } = body;

    if (!name || !ipAddress) {
      return NextResponse.json(
        { error: 'Name and IP address are required' },
        { status: 400 }
      );
    }

    const apiKey = generateApiKey();
    const vpsId = vpsDb.create(name, ipAddress, apiKey);

    return NextResponse.json({
      success: true,
      vps: {
        id: vpsId,
        name,
        ipAddress,
        apiKey,
      },
    });
  } catch (error: any) {
    console.error('Error creating VPS:', error);
    if (error.message?.includes('UNIQUE constraint failed')) {
      return NextResponse.json(
        { error: 'VPS with this name already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
