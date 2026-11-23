import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { fulfillPaidOrder } from "@/lib/fulfill";
import { getPaymentConfig, pricedItem } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { readUtm } from "@/lib/checkout-order";
import { safePath } from "@/lib/safe-path";
import { countryFromHeaders } from "@/lib/geo";
export async function POST(req: Request) {
 const user=await getCurrentUser();if(!user)return NextResponse.json({error:"Please sign in first."},{status:401});
 const pay=await getPaymentConfig();if(!pay.demoPayEnabled)return NextResponse.json({error:"Demo Pay is disabled."},{status:400});
 const key=req.headers.get("idempotency-key")||"";if(!/^[a-zA-Z0-9_-]{16,100}$/.test(key))return NextResponse.json({error:"An idempotency key is required."},{status:400});
 const body=await req.json().catch(()=>null);const item=await pricedItem({planId:body?.planId,coinPackageId:body?.coinPackageId});if(!item)return NextResponse.json({error:"Choose a valid plan or coin pack."},{status:400});
 const utm=await readUtm();const rid=user.id+":"+key;
 let orderId:string;
 try{orderId=await prisma.$transaction(async tx=>{
 const existing=await tx.checkoutRequest.findUnique({where:{id:rid}});
 if(existing){const old=await tx.order.findUniqueOrThrow({where:{id:existing.orderId}});if(old.userId!==user.id || old.planId!==(item.plan?.id||null)||old.coinPackageId!==(item.pack?.id||null))throw new Error("Idempotency key mismatch");return existing.orderId;}
 const order=await tx.order.create({data:{userId:user.id,type:item.kind==="plan"?"subscription":"coins",amountCents:item.amountCents,listAmountCents:item.listCents,currency:item.currency,status:"pending",provider:"demo",providerRef:`demo_${key}`,planId:item.plan?.id,coinPackageId:item.pack?.id,promoId:item.promoId,...utm,country:countryFromHeaders(req.headers)}});
 await tx.checkoutRequest.create({data:{id:rid,userId:user.id,orderId:order.id}});return order.id;
 });}catch{return NextResponse.json({error:"Checkout could not start. Retry with the same request key."},{status:409});}
 await fulfillPaidOrder(orderId);
 const next=safePath(body?.next,"/account");
 return NextResponse.json({ok:true,orderId,redirect:`/checkout/success?orderId=${encodeURIComponent(orderId)}&next=${encodeURIComponent(next)}`});
}
