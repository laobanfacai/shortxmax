import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  testR2StudioConnection,
  normalizeBaseUrl,
  resolveR2Studio,
  sanitizeStudioText,
} from "@/lib/r2-studio";
import { publicStorageStatus } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "无权操作" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as {
    enable?: boolean;
    baseUrl?: string;
    apiKey?: string;
  };
  const enable = body.enable !== false;

  if (!enable) {
    await prisma.siteSettings.upsert({
      where: { id: "default" },
      update: { storageMode: "r2studio", r2StudioEnabled: false },
      create: { id: "default", storageMode: "r2studio", r2StudioEnabled: false },
    });
    return NextResponse.json({
      ok: true,
      ...(await publicStorageStatus()),
      message: "已停用 R2 Studio 通道。新文件不会改走官方桶直传，也不会写入本机磁盘。请重新测试并启用后才能上传。已保存的 Key 仍留在服务器。",
    });
  }

  const test = await testR2StudioConnection({ baseUrl: body.baseUrl, apiKey: body.apiKey });
  if (!test.ok) {
    await prisma.siteSettings.update({
      where: { id: "default" },
      data: { r2StudioLastError: test.message.slice(0, 500), r2StudioEnabled: false },
    }).catch(() => null);
    return NextResponse.json(
      { ok: false, message: sanitizeStudioText(test.message), pool: test.pool || null },
      { status: 400 },
    );
  }

  const current = await resolveR2Studio();
  const typed = (body.apiKey || "").trim();
  const data: Record<string, unknown> = {
    storageMode: "r2studio",
    r2StudioEnabled: true,
    r2StudioTestedAt: new Date(),
    r2StudioLastError: "",
    r2StudioBaseUrl: normalizeBaseUrl(body.baseUrl || current.baseUrl),
  };
  if (typed && !current.keyFromEnv) data.r2StudioApiKey = typed;

  await prisma.siteSettings.upsert({
    where: { id: "default" },
    update: data,
    create: { id: "default", ...data, r2StudioApiKey: typed && !current.keyFromEnv ? typed : "" },
  });
  if (admin.id) {
    await prisma.adminAudit.create({
      data: { actorId: admin.id, userId: admin.id, action: "storage_r2studio_enable", detail: "已启用 R2 Studio 作为上传通道" },
    }).catch(() => null);
  }
  const status = await publicStorageStatus();
  return NextResponse.json({
    ok: true,
    ...status,
    pool: test.pool || status.pool || null,
    message: sanitizeStudioText(test.message) + " 已启用 R2 Studio，之后后台上传的封面和视频会走这条通道。",
  });
}
