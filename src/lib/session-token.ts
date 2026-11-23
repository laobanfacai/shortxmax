import { SignJWT, jwtVerify } from "jose";

export const AUTH_COOKIE = "lumereel_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  sessionVersion?: number;
};

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET is missing or too short. Set it in .env");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(user: SessionUser) {
  return new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    sessionVersion: user.sessionVersion || 0,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.email !== "string") return null;
    return {
      id: payload.sub,
      sessionVersion: typeof payload.sessionVersion === "number" ? payload.sessionVersion : 0,
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : null,
      role: typeof payload.role === "string" ? payload.role : "user",
      status: typeof payload.status === "string" ? payload.status : "active",
    };
  } catch {
    return null;
  }
}
