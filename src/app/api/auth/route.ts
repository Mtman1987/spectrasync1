import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { getSessionOptions, type SessionData } from '@/lib/session';
import { saveAdminInfo } from '@/app/actions';

export async function POST(request: NextRequest) {
  try {
    const { discordId, username } = await request.json();
    
    if (!discordId || !username) {
      return NextResponse.json({ error: 'Discord ID and username required' }, { status: 400 });
    }

    const adminData = {
      discordInfo: {
        id: discordId,
        username: username,
        avatar: null,
      },
      discordUserGuilds: [],
      manualLogin: true,
    };

    await saveAdminInfo(discordId, adminData);

    const sessionOptions = await getSessionOptions();
    const session = await getIronSession<SessionData>(cookies(), sessionOptions);
    session.adminId = discordId;
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Manual login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}