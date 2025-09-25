// src/lib/session.ts
import type { IronSessionOptions } from 'iron-session';
import { getRuntimeValue } from './runtime-config';

export interface SessionData {
  adminId?: string;
  isLoggedIn: boolean;
}

export async function getSessionOptions(): Promise<IronSessionOptions> {
    const secret = await getRuntimeValue<string>('SESSION_SECRET', process.env.SESSION_SECRET) || 'cosmic-raid-session-secret-2024';
    if (!secret) {
        throw new Error('SESSION_SECRET is not set in runtime configuration.');
    }
    return {
        password: secret,
        cookieName: 'cosmic-raid-session',
        cookieOptions: {
            secure: process.env.NODE_ENV === 'production',
        },
    };
}
