import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import {
  AUTH_COOKIE,
  SESSION_MAX_AGE,
  signSession,
  verifySession,
  type SessionUser,
} from "./session-token";

export { AUTH_COOKIE, signSession, verifySession, type SessionUser };

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function setSessionCookie(user: SessionUser) {
  const token = await signSession(user);
  const jar = await cookies();
  jar.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(AUTH_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;
  const current = await prisma.user.findUnique({ where: { id: session.id }, select: { status: true, role: true, sessionVersion: true, name: true } });
  if (!current || current.status !== "active" || current.sessionVersion !== (session.sessionVersion || 0)) return null;
  return { ...session, role: current.role, status: current.status, name: current.name };
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      coins: true,
      createdAt: true,
    },
  });
  if (!user || user.status === "banned") return null;
  return user;
}

export async function getBannedViewer() {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE)?.value;
  if (!token) return false;
  const session = await verifySession(token);
  if (!session) return false;
  if (session.status === "banned") return true;
  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { status: true } });
  return user?.status === "banned";
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

export function toSession(user: {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  sessionVersion?: number;
}): SessionUser {
  return {
    sessionVersion: user.sessionVersion || 0,
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
  };
}
