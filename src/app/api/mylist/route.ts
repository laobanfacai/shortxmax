import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const seriesId = String(body?.seriesId || "");
  const add = body?.add !== false;
  if (!seriesId) return NextResponse.json({ error: "Missing series." }, { status: 400 });
  if (!(await prisma.series.findFirst({where:{id:seriesId,status:"published"}}))) return NextResponse.json({error:"Show not found."},{status:404});
  if (add) {
    await prisma.myListItem.upsert({
      where: { userId_seriesId: { userId: user.id, seriesId } },
      update: {},
      create: { userId: user.id, seriesId },
    });
  } else {
    await prisma.myListItem.deleteMany({ where: { userId: user.id, seriesId } });
  }
  return NextResponse.json({ ok: true, on: add });
}
