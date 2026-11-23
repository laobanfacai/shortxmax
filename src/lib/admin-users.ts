import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";
export async function userSearch(sp:{q?:string;status?:string;vip?:string;page?:string},members=false) {
 const q=(sp.q||"").trim().slice(0,100); const now=new Date(); const live={status:{in:["active","canceled"]},endsAt:{gt:now}};
 const page=Math.max(1,Math.min(100000,parseInt(sp.page||"1")||1)); const perPage=15;
 const where:Prisma.UserWhereInput={
 ...(q?{OR:[{email:{contains:q}},{name:{contains:q}}]}:{}),
 ...(["active","banned"].includes(sp.status||"")?{status:sp.status}:{}),
 ...(sp.vip==="active"?{subscriptions:{some:live}}:sp.vip==="expired"?{AND:[{subscriptions:{some:{}}},{subscriptions:{none:live}}]}:sp.vip==="none"?{subscriptions:{none:{}}}:members?{subscriptions:{some:{}}}:{}),
 };
 const [total,users]=await Promise.all([prisma.user.count({where}),prisma.user.findMany({where,skip:(page-1)*perPage,take:perPage,orderBy:{createdAt:"desc"},include:{subscriptions:{where:live,orderBy:{endsAt:"desc"},include:{plan:true},take:1},_count:{select:{orders:true,watchHistory:true}}}})]);
 return {total,users,page,pages:Math.max(1,Math.ceil(total/perPage))};
}
