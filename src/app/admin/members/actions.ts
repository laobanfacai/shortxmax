"use server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
export async function manageMember(form: FormData) {
 const admin=await requireAdmin();if(!admin)throw new Error("无权操作");
 const userId=String(form.get("userId")||""); const action=String(form.get("action")||"");
 const days=Number(form.get("days")||30);const reason=String(form.get("reason")||"").trim();
 if(!["grant","extend","revoke"].includes(action)||!reason||reason.length>300||!Number.isInteger(days)||days<1||days>3650)throw new Error("请填写原因和有效天数（1–3650）");
 await prisma.$transaction(async tx=>{
 const user=await tx.user.findUnique({where:{id:userId}});if(!user||user.role==="admin")throw new Error("不能修改管理员或不存在的账号");
 const now=new Date();let detail="";
 if(action==="revoke") { const result=await tx.subscription.updateMany({where:{userId,status:{in:["active","canceled"]}},data:{status:"revoked",endsAt:now}}); detail=`撤销 ${result.count} 条会员权益`;
 }else{
 if(user.status!=="active")throw new Error("请先解除账号禁用");
 const planId=String(form.get("planId")||"");const plan=await tx.plan.findUnique({where:{id:planId}});if(!plan||!plan.isEnabled)throw new Error("请选择有效套餐");
 const current=await tx.subscription.findFirst({where:{userId,status:{in:["active","canceled"]},endsAt:{gt:now}},orderBy:{endsAt:"desc"}});
 if(action==="extend"&&!current)throw new Error("用户没有有效会员，请使用授予");
 const base=current?.endsAt||now; const endsAt=new Date(base.getTime()+days*86400000);
 // Keep independent order-backed entitlements intact; admin grants/extends a separate entitlement.
 await tx.subscription.create({data:{userId,planId,status:"active",provider:"admin",startsAt:now,endsAt}});
 detail=`${action==="extend"?"延长":"授予"} ${days} 天，原到期 ${current?.endsAt.toISOString()||"无"}，新到期 ${endsAt.toISOString()}`;
 }
 await tx.adminAudit.create({data:{actorId:admin.id,userId,action,detail:`${detail}；原因：${reason}`}});
 });
 revalidatePath("/admin/members");revalidatePath("/admin/users");revalidatePath(`/admin/users/${userId}`);revalidatePath("/account");
}
