import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { authSessions, db, defaultGroupId, groupMemberships, passwordCredentials, userListSettings, users } from '@music-rank/database';
import type { RegisterInput } from '@music-rank/contracts';
import { AppError } from './errors.js';

const SCRYPT_N = 2 ** 14;
const SCRYPT_R = 8;
const SCRYPT_P = 5;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_MAX_MEMORY = 32 * 1024 * 1024;
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
// Storage placeholder only; verifyPassword must never accept this as a hash.
export const transitionalPasswordPlaceholder = 'DISABLED_USERNAME_ONLY_V1';

export type AuthenticatedUser = {
  id: string;
  username: string;
  displayName: string;
};

export type ResolvedSession = {
  sessionId: string;
  user: AuthenticatedUser;
};

function derivePassword(password: string, salt: Buffer, options = { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, SCRYPT_KEY_LENGTH, { ...options, maxmem: SCRYPT_MAX_MEMORY }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await derivePassword(password, salt);
  return ['scrypt', 'v1', SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString('base64url'), derivedKey.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [algorithm, version, nValue, rValue, pValue, saltValue, keyValue] = encodedHash.split('$');
  if (algorithm !== 'scrypt' || version !== 'v1' || !nValue || !rValue || !pValue || !saltValue || !keyValue) return false;
  const N = Number(nValue);
  const r = Number(rValue);
  const p = Number(pValue);
  if (N !== SCRYPT_N || r !== SCRYPT_R || p !== SCRYPT_P) return false;
  try {
    const expected = Buffer.from(keyValue, 'base64url');
    const actual = await derivePassword(password, Buffer.from(saltValue, 'base64url'), { N, r, p });
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function isUsernameConflict(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 5 && typeof current === 'object' && current !== null; depth += 1) {
    if ('code' in current && current.code === '23505'
      && 'constraint' in current && current.constraint === 'users_username_unique') return true;
    current = 'cause' in current ? current.cause : null;
  }
  return false;
}

export async function registerUser(input: RegisterInput): Promise<{ user: AuthenticatedUser; session: { token: string; expiresAt: Date } }> {
  const user: AuthenticatedUser = { id: randomUUID(), username: input.username, displayName: input.username };
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  try {
    await db.transaction(async (transaction) => {
      await transaction.insert(users).values(user);
      await transaction.insert(groupMemberships).values({ groupId: defaultGroupId, userId: user.id });
      await transaction.insert(passwordCredentials).values({ userId: user.id, passwordHash: transitionalPasswordPlaceholder });
      await transaction.insert(userListSettings).values([
        { userId: user.id, listType: 'TOP_LIST', visibility: 'PUBLIC' },
        { userId: user.id, listType: 'SINGING_LIST', visibility: 'PUBLIC' }
      ]);
      await transaction.insert(authSessions).values({ id: randomUUID(), userId: user.id, tokenHash: hashSessionToken(token), expiresAt });
    });
  } catch (error) {
    if (isUsernameConflict(error)) throw new AppError(409, 'USERNAME_TAKEN', 'This username is already registered. Sign in instead.');
    throw error;
  }
  return { user, session: { token, expiresAt } };
}

// Username alone establishes account access during the accepted transition.
export async function authenticateUsername(username: string): Promise<AuthenticatedUser> {
  const [account] = await db.select({
    id: users.id,
    username: users.username,
    displayName: users.displayName
  }).from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!account || !account.username) {
    throw new AppError(404, 'USERNAME_NOT_REGISTERED', 'This username is not registered. Register to create an account.');
  }
  return { id: account.id, username: account.username, displayName: account.displayName };
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.insert(authSessions).values({
    id: randomUUID(),
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt
  });
  return { token, expiresAt };
}

export async function resolveSession(token: string): Promise<ResolvedSession | null> {
  const tokenHash = hashSessionToken(token);
  const [session] = await db.select({
    sessionId: authSessions.id,
    expiresAt: authSessions.expiresAt,
    userId: users.id,
    username: users.username,
    displayName: users.displayName
  }).from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(eq(authSessions.tokenHash, tokenHash))
    .limit(1);

  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await db.delete(authSessions).where(and(eq(authSessions.id, session.sessionId), eq(authSessions.tokenHash, tokenHash)));
    return null;
  }
  if (!session.username) return null;
  return {
    sessionId: session.sessionId,
    user: { id: session.userId, username: session.username, displayName: session.displayName }
  };
}

export async function revokeSession(token: string): Promise<void> {
  await db.delete(authSessions).where(eq(authSessions.tokenHash, hashSessionToken(token)));
}

export const sessionDurationMs = SESSION_DURATION_MS;
