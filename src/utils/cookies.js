import { env } from '../config/env.js';

const cookieName = 'refreshToken';

export const setRefreshCookie = (res, token) => {
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  });
};

export const clearRefreshCookie = (res) => {
  res.clearCookie(cookieName, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  });
};

export const getRefreshTokenFromCookies = (req) => {
  return req.cookies?.[cookieName];
};
