import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getActiveSubscription } from "@/lib/access";
import { prisma } from "@/lib/prisma";
export async function POST(req:Request) {
 const user=await getCurrentUser();if(!user)return NextResponse.json({error:"Please sign in first."},{status:401});
 const body=await req.json().catch(()=>null);const episodeId=String(body?.episodeId||"");
 const ep=await prisma.episode.findFirst({where:{id:episodeId,isPublished:true,series:{status:"published"}}});if(!ep)return NextResponse.json({error:"Episode not found."},{status:404});
 if(ep.isFree||await getActiveSubscription(user.id))return NextResponse.json({ok:true,already:true});
 const result=await prisma.$transaction(async tx=>{
 const old=await tx.episodeUnlock.findUnique({where:{userId_episodeId:{userId:user.id,episodeId}}});if(old)return true;
 const debit=await tx.user.updateMany({where:{id:user.id,status:"active",coins:{gte:Math.max(0,ep.coinPrice)}},data:{coins:{decrement:Math.max(0,ep.coinPrice)}}});if(!debit.count)return false;
 await tx.episodeUnlock.create({data:{userId:user.id,episodeId,coinsSpent:ep.coinPrice}});
 await tx.order.create({data:{userId:user.id,type:"unlock",amountCents:0,status:"paid",provider:"coins",episodeId,paidAt:new Date()}});return true;
 });return NextResponse.json(result?{ok:true}:{error:"Not enough coins."},{status:result?200:400});
}
