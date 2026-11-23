import { PrismaClient } from "@prisma/client";
import { fulfillPaidOrder } from "../src/lib/fulfill";
import { randomUUID } from "crypto";
import { writeFileSync } from "fs";
const p=new PrismaClient();
async function main(){
 const uid="qa-fulfill-"+randomUUID();const results:{test:string;pass:boolean}[]=[];
 function check(test:string,pass:boolean){results.push({test,pass});if(!pass)throw new Error(test);console.log("PASS",test);}
 await p.user.create({data:{id:uid,email:uid+"@example.invalid",passwordHash:"!test-disabled-login"}});
 try{
 const plan=await p.plan.findFirstOrThrow();const pack=await p.coinPackage.findFirstOrThrow();
 const o=await p.order.create({data:{userId:uid,type:"subscription",amountCents:plan.priceCents,planId:plan.id,provider:"demo"}});
 await Promise.all([fulfillPaidOrder(o.id),fulfillPaidOrder(o.id),fulfillPaidOrder(o.id)]);
 check("Three concurrent callbacks create ONE entitlement",await p.subscription.count({where:{orderId:o.id}})===1);
 await p.order.update({where:{id:o.id},data:{status:"refunded"}});await p.subscription.updateMany({where:{orderId:o.id},data:{status:"revoked",endsAt:new Date(0)}});
 await fulfillPaidOrder(o.id);
 check("Refunded terminal order never regrants",await p.subscription.count({where:{orderId:o.id,status:"active"}})===0);
 const coin=await p.order.create({data:{userId:uid,type:"coins",amountCents:pack.priceCents,coinPackageId:pack.id,provider:"demo"}});
 await Promise.all([fulfillPaidOrder(coin.id),fulfillPaidOrder(coin.id)]);
 check("Concurrent coin callbacks credit ONCE",(await p.user.findUniqueOrThrow({where:{id:uid}})).coins===pack.coins+pack.bonusCoins);
 const before=await p.subscription.count({where:{userId:uid}});const bad=await p.order.create({data:{userId:uid,type:"subscription",amountCents:1,provider:"demo",status:"failed",planId:plan.id}});await fulfillPaidOrder(bad.id);
 check("Failed terminal order never fulfills",await p.subscription.count({where:{userId:uid}})===before);
 }finally{await p.subscription.deleteMany({where:{userId:uid}});await p.order.deleteMany({where:{userId:uid}});await p.user.delete({where:{id:uid}});writeFileSync('test-results/fulfillment.json',JSON.stringify({tests:results,cleaned:true},null,2));}
}
main().then(()=>p.$disconnect()).catch(async e=>{console.error(e.message);await p.$disconnect();process.exit(1)});
