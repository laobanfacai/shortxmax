import { allowAuth, validPassword } from "@/lib/auth-limit";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setSessionCookie, toSession, verifyPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  if (!allowAuth(req, email)) return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }
  if (Buffer.byteLength(password,"utf8") > 72) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
  if (user.status === "banned") {
    return NextResponse.json({ error: "This account has been disabled." }, { status: 403 });
  }
  await setSessionCookie(toSession(user));
  return NextResponse.json({ ok: true, role: user.role });
}
