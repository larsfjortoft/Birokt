import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const JWT_SECRET = env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRY = env.JWT_ACCESS_EXPIRY;
const REFRESH_TOKEN_EXPIRY = env.JWT_REFRESH_EXPIRY;

export interface TokenPayload {
  sub: string;
  email: string;
  type: 'access' | 'refresh';
}

export interface DecodedToken extends TokenPayload {
  iat: number;
  exp: number;
}

export function generateAccessToken(userId: string, email: string): string {
  const payload: TokenPayload = {
    sub: userId,
    email,
    type: 'access',
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY as unknown as number });
}

export function generateRefreshToken(userId: string, email: string): string {
  const payload: TokenPayload = {
    sub: userId,
    email,
    type: 'refresh',
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY as unknown as number });
}

export function verifyToken(token: string): DecodedToken {
  return jwt.verify(token, JWT_SECRET) as DecodedToken;
}

export function getTokenExpiration(token: string): Date {
  const decoded = jwt.decode(token) as DecodedToken;
  return new Date(decoded.exp * 1000);
}

export function getAccessTokenExpiresIn(): number {
  const expiry = ACCESS_TOKEN_EXPIRY;
  const match = expiry.match(/^(\d+)([smhd])$/);

  if (!match) return 3600;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: return 3600;
  }
}