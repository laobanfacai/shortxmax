import { NextResponse } from "next/server";
import { clearSessionCookie, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export async function POST() {
 const user=await getCurrentUser();
 if(user)await prisma.user.update({where:{id:user.id},data:{sessionVersion:{increment:1}}});
 await clearSessionCookie();return NextResponse.json({ok:true});
}
