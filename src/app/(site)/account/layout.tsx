import { AccountSubNav } from "@/components/public/AccountSubNav";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="border-b border-white/5 bg-bg/70 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <AccountSubNav />
        </div>
      </div>
      {children}
    </>
  );
}
