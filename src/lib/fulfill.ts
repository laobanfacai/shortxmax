import { prisma } from "@/lib/prisma";
import { periodToMs } from "@/lib/access";
/** Claim pending→paid and grant rights inside ONE SQLite transaction. Terminal orders never regrant. */
export async function fulfillPaidOrder(orderId: string) {
 return prisma.$transaction(async tx=>{
 const order=await tx.order.findUnique({where:{id:orderId}});
 if(!order || order.status!=="pending") return order;
 const user=await tx.user.findUnique({where:{id:order.userId}});
 if(!user)throw new Error("User missing");
 const claim=await tx.order.updateMany({where:{id:orderId,status:"pending"},data:{status:"paid",paidAt:new Date()}});
 if(claim.count!==1)return tx.order.findUnique({where:{id:orderId}});
 if(order.type==="subscription"&&order.planId){
 const plan=await tx.plan.findUnique({where:{id:order.planId}});if(!plan)throw new Error("Plan missing");
 const now=new Date();const existing=await tx.subscription.findFirst({where:{userId:order.userId,status:{in:["active","canceled"]},endsAt:{gt:now}},orderBy:{endsAt:"desc"}});
 const endsAt=new Date((existing?.endsAt||now).getTime()+periodToMs(plan.period));
 await tx.subscription.create({data:{orderId:order.id,userId:order.userId,planId:plan.id,status:"active",startsAt:now,endsAt,provider:order.provider,stripeSubId:order.providerRef}});
 }
 if(order.type==="coins"&&order.coinPackageId){const pack=await tx.coinPackage.findUnique({where:{id:order.coinPackageId}});if(!pack)throw new Error("Coin pack missing");await tx.user.update({where:{id:order.userId},data:{coins:{increment:pack.coins+pack.bonusCoins}}});}
 return tx.order.findUnique({where:{id:orderId}});
 });
}
