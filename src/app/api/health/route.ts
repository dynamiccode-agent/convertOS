import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      hasDatabase: !!process.env.DATABASE_URL,
      hasMetaToken: !!process.env.META_ACCESS_TOKEN,
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    },
  });
}
