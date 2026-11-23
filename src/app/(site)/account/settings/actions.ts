"use server";
import { getCurrentUser, hashPassword, verifyPassword, setSessionCookie, toSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validPassword } from "@/lib/auth-limit";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
export async function updateProfile(form: FormData) {
 const user = await getCurrentUser(); if (!user) redirect("/login?next=/account/settings");
 const name = String(form.get("name") || "").trim();
 if (!name || name.length > 80) redirect("/account/settings?error=name");
 const updated = await prisma.user.update({where:{id:user.id},data:{name}});
 await setSessionCookie(toSession(updated)); revalidatePath("/account"); redirect("/account/settings?saved=1");
}
export async function changePassword(form: FormData) {
 const user = await getCurrentUser(); if (!user) redirect("/login?next=/account/settings");
 const password=String(form.get("password") || ""); const current=String(form.get("current") || "");
 if (!validPassword(password) || password !== form.get("confirm")) redirect("/account/settings?error=password");
 const row=await prisma.user.findUniqueOrThrow({where:{id:user.id}});
 if (Buffer.byteLength(current)>72 || !(await verifyPassword(current,row.passwordHash))) redirect("/account/settings?error=current");
 const updated=await prisma.user.update({where:{id:user.id},data:{passwordHash:await hashPassword(password),sessionVersion:{increment:1}}});
 await setSessionCookie(toSession(updated)); redirect("/account/settings?saved=password");
}
