import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publicStorageStatus } from "@/lib/storage";
import {
  normalizeBaseUrl,
  resolveR2Studio,
  validateApiKey,
  R2S_DEFAULT_BASE,
} from "@/lib/r2-studio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "无权操作" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { baseUrl?: string; apiKey?: string };
  const current = await resolveR2Studio();
  const baseUrl = normalizeBaseUrl(body.baseUrl || current.baseUrl || R2S_DEFAULT_BASE);
  const typed = (body.apiKey || "").trim();
  const data: { r2StudioBaseUrl: string; r2StudioApiKey?: string } = { r2StudioBaseUrl: baseUrl };

  if (typed) {
    if (current.keyFromEnv) {
      return NextResponse.json(
        { ok: false, message: "当前 Key 由环境变量 R2_STUDIO_API_KEY 提供，后台保存不会覆盖它。如需更换，请改服务器环境变量。" },
        { status: 400 },
      );
    }
    const checked = validateApiKey(typed);
    if (!checked.ok) return NextResponse.json({ ok: false, message: checked.message }, { status: 400 });
    data.r2StudioApiKey = checked.key;
  }

  await prisma.siteSettings.upsert({
    where: { id: "default" },
    update: data,
    create: { id: "default", ...data, r2StudioApiKey: data.r2StudioApiKey || "" },
  });
  if (admin.id) {
    await prisma.adminAudit.create({
      data: {
        actorId: admin.id,
        userId: admin.id,
        action: "storage_r2studio_save",
        detail: typed ? "已更新 R2 Studio Base URL 与 API Key（密钥未写入日志）" : "已更新 R2 Studio Base URL",
      },
    }).catch(() => null);
  }
  const status = await publicStorageStatus();
  return NextResponse.json({ ok: true, ...status, message: "已保存。密钥只保存在服务器，不会返回给浏览器。" });
}
