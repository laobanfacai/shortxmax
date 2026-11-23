"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatDuration } from "@/lib/utils";

type EpisodeLite = {
  id: string;
  number: number;
  title: string;
  isFree: boolean;
  durationSec: number;
  videoUrl: string | null;
};

export function Player({
  seriesSlug,
  seriesTitle,
  coverUrl,
  episode,
  episodes,
  allowed,
  reason,
  coinPrice,
  coins,
  startAt,
  signedIn,
}: {
  seriesSlug: string;
  seriesTitle: string;
  coverUrl: string;
  episode: EpisodeLite;
  episodes: EpisodeLite[];
  allowed: boolean;
  reason: string;
  coinPrice: number;
  coins: number;
  startAt: number;
  signedIn: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [locked, setLocked] = useState(!allowed);
  const [teasing, setTeasing] = useState(!allowed);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(episode.durationSec || 0);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const next = episodes.find((e) => e.number === episode.number + 1);

  useEffect(() => {
    setLocked(!allowed);
    setTeasing(!allowed);
    setCurrent(startAt || 0);
  }, [allowed, episode.id, startAt]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (startAt > 1 && allowed) {
      const onMeta = () => {
        v.currentTime = Math.min(startAt, (v.duration || startAt) - 1);
      };
      v.addEventListener("loadedmetadata", onMeta, { once: true });
      return () => v.removeEventListener("loadedmetadata", onMeta);
    }
  }, [episode.id, startAt, allowed]);

  function onTime() {
    const v = videoRef.current;
    if (!v) return;
    setCurrent(v.currentTime);
    setDuration(v.duration || duration);
    if (!allowed && v.currentTime >= 5) {
      v.pause();
      v.currentTime = 5;
      setLocked(true);
      setTeasing(false);
      setPlaying(false);
    }
    if (allowed && Math.floor(v.currentTime) % 5 === 0) {
      void saveProgress(v.currentTime, false);
    }
  }

  async function saveProgress(sec: number, completed: boolean) {
    if (!signedIn || !allowed) return;
    try {
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId: episode.id, progressSec: Math.floor(sec), completed }),
      });
    } catch {
      /* ignore */
    }
  }

  function onEnded() {
    void saveProgress(duration, true);
    if (next) router.push(`/watch/${seriesSlug}/${next.number}`);
  }

  async function unlockWithCoins() {
    if (!signedIn) {
      router.push(`/login?next=/watch/${seriesSlug}/${episode.number}`);
      return;
    }
    setUnlocking(true);
    setError("");
    const res = await fetch("/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ episodeId: episode.id }),
    });
    const data = await res.json().catch(() => ({}));
    setUnlocking(false);
    if (!res.ok) {
      setError(data.error || "Could not unlock this episode.");
      return;
    }
    router.refresh();
  }

  const src = episode.videoUrl || "";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <div className="relative mx-auto aspect-[9/16] max-h-[78vh] w-full max-w-[420px] overflow-hidden rounded-2xl bg-black poster-shadow">
          {src ? (
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              poster={coverUrl}
              playsInline
              controls={allowed || teasing}
              onTimeUpdate={onTime}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={onEnded}
              src={src}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="" className="h-full w-full object-cover" />
          )}

          {locked ? (
            <div className="absolute inset-0 flex flex-col items-center justify-end bg-gradient-to-t from-black via-black/80 to-black/20 p-6 text-center">
              <p className="text-xs uppercase tracking-[0.22em] text-gold">Episode locked</p>
              <h2 className="mt-2 font-display text-3xl">Unlock this episode</h2>
              <p className="mt-2 text-sm text-white/80">
                {teasing
                  ? "The tease is over. Go VIP for the full story, or unlock just this episode."
                  : `${seriesTitle} — Ep ${episode.number}: ${episode.title}`}
              </p>
              <div className="mt-5 flex w-full flex-col gap-2">
                <Link href={`/pricing?next=${encodeURIComponent(`/watch/${seriesSlug}/${episode.number}`)}`} onClick={() => sessionStorage.setItem("lumereel_resume", `/watch/${seriesSlug}/${episode.number}`)} className="btn btn-gold btn-lg">
                  Go VIP — binge the rest
                </Link>
                <button
                  type="button"
                  className="btn btn-outline-gold btn-lg"
                  onClick={unlockWithCoins}
                  disabled={unlocking}
                >
                  {unlocking ? "Unlocking…" : `Unlock with ${coinPrice} coins`}
                </button>
                {signedIn ? (
                  <p className="text-xs text-white/60">You have {coins} coins</p>
                ) : (
                  <Link href={`/login?next=/watch/${seriesSlug}/${episode.number}`} className="text-xs text-gold-soft">
                    Sign in to unlock or subscribe
                  </Link>
                )}
                {error ? <p className="text-xs text-danger">{error}</p> : null}
              </div>
            </div>
          ) : null}
        </div>
        <div className="mx-auto mt-4 max-w-[420px]">
          <p className="text-xs uppercase tracking-[0.18em] text-gold">
            {seriesTitle} · Episode {episode.number}
          </p>
          <h1 className="mt-1 font-display text-3xl">{episode.title}</h1>
          <p className="mt-1 text-xs text-muted">
            {formatDuration(current)} / {formatDuration(duration || episode.durationSec)}
            {playing ? " · Playing" : ""}
          </p>
        </div>
      </div>

      <aside>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Episodes</h2>
          <Link href={`/shows/${seriesSlug}`} className="text-sm text-gold">
            Series info
          </Link>
        </div>
        <ol className="mt-4 max-h-[70vh] space-y-1 overflow-auto pr-1">
          {episodes.map((ep) => {
            const active = ep.number === episode.number;
            return (
              <li key={ep.id}>
                <Link
                  href={`/watch/${seriesSlug}/${ep.number}`}
                  className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm ${
                    active ? "bg-gold/15 text-gold-soft ring-1 ring-gold/30" : "hover:bg-white/5"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="mr-2 tabular-nums text-muted">{String(ep.number).padStart(2, "0")}</span>
                    <span className="truncate">{ep.title}</span>
                  </span>
                  <span className="ml-2 shrink-0 text-[10px] uppercase text-muted">
                    {ep.isFree ? "Free" : "VIP"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}
