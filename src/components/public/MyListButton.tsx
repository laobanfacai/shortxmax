"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MyListButton({
  seriesId,
  initial,
  signedIn,
}: {
  seriesId: string;
  initial: boolean;
  signedIn: boolean;
}) {
  const [on, setOn] = useState(initial);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function toggle() {
    if (!signedIn) {
      router.push(`/login?next=/shows`);
      return;
    }
    setPending(true);
    const res = await fetch("/api/mylist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seriesId, add: !on }),
    });
    setPending(false);
    if (res.ok) setOn(!on);
  }

  return (
    <button type="button" className="btn btn-ghost btn-lg" onClick={toggle} disabled={pending}>
      {on ? "On your list" : "Add to my list"}
    </button>
  );
}
