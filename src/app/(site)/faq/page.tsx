import type { Metadata } from "next";
import { buildMetadata, JsonLd } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

const faqs = [
  {
    q: "What is ShortXMax?",
    a: "ShortXMax is an independent streaming site for original English short dramas. Watch on the web, start with free episodes, and subscribe to VIP when you want the rest of a series.",
  },
  {
    q: "Are the first episodes really free?",
    a: "Yes. Each series offers a set number of free episodes — usually the first two to five — so you can fall into the story before you pay. Locked episodes may play a short tease, then ask you to go VIP or unlock with coins.",
  },
  {
    q: "What does VIP include?",
    a: "An active VIP plan unlocks every published episode in the catalog for the length of your plan, with no per-episode charge. Plans are weekly, monthly, or yearly. You can cancel anytime and keep access until the period ends.",
  },
  {
    q: "What are coins for?",
    a: "Coins let you unlock a single episode without a subscription. Buy a coin pack, then spend coins on the episode lock screen. Unused coins stay on your account.",
  },
  {
    q: "Can I watch on my phone?",
    a: "Yes. The site is designed mobile-first, with a vertical player that feels like an app. You can also watch on a desktop or tablet browser.",
  },
  {
    q: "How do I cancel?",
    a: "Open your account page and manage your plan, or email support@lumereel.com. Cancellation stops future renewals. It does not automatically refund time already used — see the Refund Policy.",
  },
  {
    q: "Do you have an official app?",
    a: "The website is the official experience today. You can add it to your home screen from a mobile browser for an app-like shortcut.",
  },
  {
    q: "Who owns these stories?",
    a: "The series on ShortXMax are original works presented by ShortXMax. Titles, characters, and artwork are not affiliated with other short-drama apps or studios.",
  },
];

export const metadata: Metadata = buildMetadata({
  title: "FAQ",
  description:
    "Answers about ShortXMax VIP plans, free episodes, coins, cancellation, and how to watch English short dramas.",
  path: "/faq",
});

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }}
      />
      <p className="text-xs uppercase tracking-[0.22em] text-gold">Help</p>
      <h1 className="mt-2 font-display text-5xl">Frequently asked questions</h1>
      <p className="mt-3 text-muted">
        Quick answers about watching on {siteConfig.name}. Still stuck? Email {siteConfig.supportEmail}.
      </p>
      <div className="mt-8 space-y-3">
        {faqs.map((f) => (
          <details key={f.q} className="rounded-2xl border border-white/10 bg-surface px-5 py-4" open>
            <summary className="cursor-pointer font-medium">{f.q}</summary>
            <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
