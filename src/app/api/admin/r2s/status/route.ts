import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { publicStorageStatus } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "无权操作" }, { status: 403 });
  return NextResponse.json(await publicStorageStatus());
}
