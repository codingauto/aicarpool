import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'aicarpool',
    version: process.env.npm_package_version || 'unknown',
    timestamp: new Date().toISOString(),
  });
}
