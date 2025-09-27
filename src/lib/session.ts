// src/lib/session.ts
import type { IronSessionOptions } from 'iron-session';
import { getRuntimeValue } from './runtime-config';

export interface SessionData {
  adminId?: string;
  isLoggedIn: boolean;
}

export async function getSessionOptions(): Promise<IronSessionOptions> {
    let secret: string;
    try {
        secret = await Promise.race([
            getRuntimeValue<string>('SESSION_SECRET', process.env.SESSION_SECRET),
            new Promise<string>((resolve) => 
                setTimeout(() => resolve(process.env.SESSION_SECRET || 'cosmic-raid-session-secret-2024-long-enough-for-iron-session-requirements'), 2000)
            )
        ]) || 'cosmic-raid-session-secret-2024-long-enough-for-iron-session-requirements';
    } catch (error) {
        console.warn('Failed to get session secret from runtime config, using fallback:', error);
        secret = process.env.SESSION_SECRET || 'cosmic-raid-session-secret-2024-long-enough-for-iron-session-requirements';
    }
    
    return {
        password: secret,
        cookieName: 'cosmic-raid-session',
        cookieOptions: {
            secure: process.env.NODE_ENV === 'production',
        },
    };
}
