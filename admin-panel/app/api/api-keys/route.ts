import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { apiKeyDb } from '@/lib/db';
import { generateApiKey, hashApiKey } from '@/lib/crypto';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const apiKeys = apiKeyDb.findAll();
    return NextResponse.json({ apiKeys });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);

    const keyId = apiKeyDb.create(name, keyHash);

    return NextResponse.json({
      success: true,
      apiKey: {
        id: keyId,
        name,
        key: apiKey,
      },
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
