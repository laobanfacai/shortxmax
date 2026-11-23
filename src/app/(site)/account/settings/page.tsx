import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { updateProfile, changePassword } from "./actions";
export const metadata={title:"Profile & security",robots:{index:false,follow:false}};
export default async function Settings({searchParams}:{searchParams:Promise<{error?:string;saved?:string}>}) {
 const user=await getCurrentUser();if(!user)redirect("/login?next=/account/settings"); const sp=await searchParams;
 const error=sp.error==="current"?"Current password is incorrect.":sp.error==="password"?"New passwords must match and be 8–72 UTF-8 bytes.":sp.error?"Enter a name of 1–80 characters.":"";
 return <div className="mx-auto max-w-2xl px-4 py-12"><Link href="/account" className="text-gold">← Account</Link><h1 className="mt-4 font-display text-4xl">Profile & security</h1>{error&&<p role="alert" className="mt-4 text-danger">{error}</p>}{sp.saved&&<p role="status" className="mt-4 text-gold">Saved successfully. Password changes sign out other sessions.</p>}
 <form action={updateProfile} className="mt-6 space-y-4 rounded-2xl bg-surface p-6"><h2 className="text-xl">Your profile</h2><p className="text-sm text-muted">Email: {user.email} · Email verification is not configured.</p><label className="label">Display name<input name="name" required maxLength={80} className="input" defaultValue={user.name||""}/></label><button className="btn btn-gold btn-md">Save profile</button></form>
 <form action={changePassword} className="mt-6 space-y-4 rounded-2xl bg-surface p-6"><h2 className="text-xl">Change password</h2><label className="label">Current password<input name="current" required type="password" autoComplete="current-password" className="input"/></label><label className="label">New password<input name="password" required type="password" minLength={8} maxLength={72} autoComplete="new-password" className="input"/></label><label className="label">Confirm new password<input name="confirm" required type="password" minLength={8} maxLength={72} autoComplete="new-password" className="input"/></label><button className="btn btn-gold btn-md">Update password</button></form><p className="mt-6 text-sm text-muted">Password reset by email is not available yet. No email service is connected.</p></div>;
}
