import { PrismaClient } from "@prisma/client";
const p=new PrismaClient();
async function main(){
 let n=0;
 const orders=await p.order.findMany({where:{status:"paid",type:"subscription",planId:{not:null}}});
 for(const o of orders){
 if(await p.subscription.findUnique({where:{orderId:o.id}}))continue;
 const ordersForUser=orders.filter(x=>x.userId===o.userId&&x.planId===o.planId&&x.provider===o.provider);
 const candidates=await p.subscription.findMany({where:{userId:o.userId,planId:o.planId!,provider:o.provider,orderId:null}});
 // Only unambiguous 1:1 legacy data; never guess if user purchased several periods.
 if(ordersForUser.length===1&&candidates.length===1){await p.subscription.update({where:{id:candidates[0].id},data:{orderId:o.id}});n++;}
 }
 console.log(`Linked ${n} unambiguous existing order entitlements. No rows removed.`);
} main().finally(()=>p.$disconnect());
