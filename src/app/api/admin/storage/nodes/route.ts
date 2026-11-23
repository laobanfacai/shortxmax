import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listAdminStorageNodes } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "无权操作" }, { status: 403 });
  try {
    const data = await listAdminStorageNodes();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "无法读取存储配置";
    return NextResponse.json({ error: message.slice(0, 240) }, { status: 500 });
  }
}
