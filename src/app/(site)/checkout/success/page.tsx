import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getActiveSubscription } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { safePath } from "@/lib/safe-path";
import { TrackOnView } from "@/components/public/TrackOnView";
export const metadata={title:"Checkout result",robots:{index:false,follow:false}};
export default async function Success({searchParams}:{searchParams:Promise<{orderId?:string;session_id?:string;next?:string}>}) {
 const user=await getCurrentUser();if(!user)redirect("/login?next=/account");const sp=await searchParams;
 const order=(sp.orderId||sp.session_id)?await prisma.order.findFirst({where:{userId:user.id,...(sp.orderId?{id:sp.orderId}:{providerRef:sp.session_id})}}):null;
 const vip=await getActiveSubscription(user.id);const paid=order?.status==="paid";
 return <div className="mx-auto max-w-xl px-4 py-20 text-center">{paid&&order.provider!=="demo"&&<TrackOnView event="Purchase" params={{value:order.amountCents/100,currency:order.currency,transaction_id:order.id}}/>}<h1 className="font-display text-4xl">{paid?(order.provider==="demo"?"Demo complete — no real charge":"Payment confirmed"):"Check your order status"}</h1><p className="mt-4 text-muted">{paid?(vip?`VIP active until ${vip.endsAt.toLocaleString("en-US",{timeZone:"Asia/Shanghai"})} Asia/Shanghai.`:"Your order has been applied."):"No confirmed payment for this receipt. Check your account or refresh after payment verification."}</p>{paid&&<Link href={safePath(sp.next,"/shows")} className="btn btn-gold btn-lg mt-6">Continue watching</Link>}<Link href="/account" className="btn btn-ghost btn-lg mt-6">View account & orders</Link></div>;
}
