import { allowAuth, validPassword } from "@/lib/auth-limit";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, setSessionCookie, toSession } from "@/lib/auth";
import { utmFromCookieHeader } from "@/lib/utm";
import { countryFromHeaders } from "@/lib/geo";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  const name = String(body?.name || "").trim() || null;
  if (!allowAuth(req, email)) return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  if (!validPassword(password)) {
    return NextResponse.json({ error: "Password must be at least 8 characters and at most 72 UTF-8 bytes." }, { status: 400 });
  }
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }
  const utm = utmFromCookieHeader(req.headers.get("cookie"));
  if (name && name.length > 80) return NextResponse.json({ error: "Name must be at most 80 characters." }, { status: 400 });
  let user;
  try { user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await hashPassword(password),
      utmSource: utm.utmSource || "",
      utmMedium: utm.utmMedium || "",
      utmCampaign: utm.utmCampaign || "",
      country: countryFromHeaders(req.headers),
    },
  });
  } catch (err) { if ((err as { code?: string }).code === "P2002") return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 }); throw err; }
  await setSessionCookie(toSession(user));
  return NextResponse.json({ ok: true });
}
