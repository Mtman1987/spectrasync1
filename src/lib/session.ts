// src/lib/session.ts
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';

interface SessionData {
  adminId?: string;
  isLoggedIn: boolean;
}

export const getSession = () => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET is not set in environment variables.');
  }
  return getIronSession<SessionData>(cookies(), {
    password: secret,
    cookieName: 'cosmic-raid-session',
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
    },
  });
};