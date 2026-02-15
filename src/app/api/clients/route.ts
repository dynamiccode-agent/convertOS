import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET /api/clients
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clients = await prisma.client.findMany({
      where: { status: 'active' },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            connections: true,
            leads: true,
            orders: true,
            contacts: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, clients });
  } catch (error: any) {
    console.error('[Clients API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch clients', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/clients - Create new client
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, domain, timezone } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    // Generate slug from name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const client = await prisma.client.create({
      data: {
        name,
        slug,
        domain,
        timezone: timezone || 'UTC',
        status: 'active',
      },
    });

    return NextResponse.json({ success: true, client });
  } catch (error: any) {
    console.error('[Clients API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create client', details: error.message },
      { status: 500 }
    );
  }
}
