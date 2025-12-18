import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData, defaultSession } from './session';
import { NextRequest, NextResponse } from 'next/server';
import { vpsDb, apiKeyDb } from './db';
import { verifyApiKey } from './crypto';

export async function getSession() {
  return await getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function requireAuth(request: NextRequest): Promise<SessionData | NextResponse> {
  const session = await getSession();

  if (!session.isLoggedIn) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return session;
}

export async function requireAdmin(request: NextRequest): Promise<SessionData | NextResponse> {
  const session = await getSession();

  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  return session;
}

export function verifyVpsApiKey(request: NextRequest): string | NextResponse {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Missing or invalid authorization header' },
      { status: 401 }
    );
  }

  const apiKey = authHeader.substring(7);
  const vps = vpsDb.findByApiKey(apiKey);

  if (!vps) {
    return NextResponse.json(
      { error: 'Invalid API key' },
      { status: 401 }
    );
  }

  return apiKey;
}

export function verifyDeployApiKey(request: NextRequest): boolean | NextResponse {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Missing or invalid authorization header' },
      { status: 401 }
    );
  }

  const apiKey = authHeader.substring(7);
  const allApiKeys = apiKeyDb.findAll();

  for (const dbKey of allApiKeys) {
    if (verifyApiKey(apiKey, dbKey.key_hash)) {
      apiKeyDb.updateLastUsed(dbKey.id);
      return true;
    }
  }

  return NextResponse.json(
    { error: 'Invalid API key' },
    { status: 401 }
  );
}
