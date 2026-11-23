import { canWatchEpisode } from "@/lib/access";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const episodeId = String(body?.episodeId || "");
  const progressSec = Math.max(0, Number(body?.progressSec) || 0);
  const completed = Boolean(body?.completed);
  if (!episodeId) return NextResponse.json({ error: "Missing episode." }, { status: 400 });
  const ep=await prisma.episode.findFirst({where:{id:episodeId,isPublished:true,series:{status:"published"}}});
  if (!ep) return NextResponse.json({error:"Episode not found."},{status:404});
  if (!(await canWatchEpisode({userId:user.id,episodeId,isFree:ep.isFree})).allowed) return NextResponse.json({error:"VIP or unlock required."},{status:403});
  if (!Number.isFinite(progressSec) || progressSec > 86400) return NextResponse.json({error:"Invalid progress."},{status:400});
  await prisma.watchHistory.upsert({
    where: { userId_episodeId: { userId: user.id, episodeId } },
    update: { progressSec, completed: completed || undefined },
    create: { userId: user.id, episodeId, progressSec, completed },
  });
  return NextResponse.json({ ok: true });
}
