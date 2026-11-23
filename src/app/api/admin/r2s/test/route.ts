import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { testR2StudioConnection, normalizeBaseUrl, sanitizeStudioText } from "@/lib/r2-studio";
import { publicStorageStatus } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "无权操作" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { baseUrl?: string; apiKey?: string };
  const result = await testR2StudioConnection({
    baseUrl: body.baseUrl,
    apiKey: body.apiKey,
  });
  if (result.ok) {
    await prisma.siteSettings.upsert({
      where: { id: "default" },
      update: {
        r2StudioLastError: "",
        r2StudioTestedAt: new Date(),
        ...(body.baseUrl ? { r2StudioBaseUrl: normalizeBaseUrl(body.baseUrl) } : {}),
      },
      create: {
        id: "default",
        r2StudioLastError: "",
        r2StudioTestedAt: new Date(),
        r2StudioBaseUrl: normalizeBaseUrl(body.baseUrl),
      },
    });
  } else {
    await prisma.siteSettings.upsert({
      where: { id: "default" },
      update: { r2StudioLastError: result.message.slice(0, 500) },
      create: { id: "default", r2StudioLastError: result.message.slice(0, 500) },
    }).catch(() => null);
  }
  const status = await publicStorageStatus();
  return NextResponse.json({
    ok: result.ok,
    ...status,
    pool: result.pool || status.pool || null,
    message: sanitizeStudioText(result.message),
  });
}
