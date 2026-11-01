import { NextResponse } from 'next/server';
import { getSession, saveSession, clearSession } from '@/lib/db';

export async function GET(request) {
  try {
    const session = getSession('default');
    return NextResponse.json({ success: true, session });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const updated = saveSession(body, 'default');
    return NextResponse.json({ success: true, session: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    clearSession('default');
    const response = NextResponse.json({ success: true });
    response.cookies.delete('music_sync_session');
    return response;
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

