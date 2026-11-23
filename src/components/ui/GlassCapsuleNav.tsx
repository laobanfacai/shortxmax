"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type CapsuleAxis = "x" | "y" | "auto";

type Rect = { left: number; top: number; width: number; height: number };

type GlassCapsuleNavProps = {
  activeKey: string | null;
  axis?: CapsuleAxis;
  className?: string;
  children: ReactNode;
  as?: "nav" | "div" | "ul";
  "aria-label"?: string;
};

const NEAR = 0.6;
const MOVE_MS = 560;
const REDUCE_MS = 160;
const RETRY_MS = [0, 32, 80, 160, 320, 640, 1200];

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function mid(a: number, b: number) {
  return (a + b) / 2;
}

function sameRect(a: Rect, b: Rect) {
  return (
    Math.abs(a.left - b.left) < NEAR &&
    Math.abs(a.top - b.top) < NEAR &&
    Math.abs(a.width - b.width) < NEAR &&
    Math.abs(a.height - b.height) < NEAR
  );
}

function toKeyframes(r: Rect) {
  return {
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
  };
}

function applyRect(el: HTMLElement, r: Rect) {
  el.style.left = `${r.left}px`;
  el.style.top = `${r.top}px`;
  el.style.width = `${r.width}px`;
  el.style.height = `${r.height}px`;
  el.dataset.ready = "true";
  el.dataset.capsuleWidth = String(Math.round(r.width));
  el.dataset.capsuleHeight = String(Math.round(r.height));
}

function readRect(el: HTMLElement): Rect {
  return {
    left: parseFloat(el.style.left) || 0,
    top: parseFloat(el.style.top) || 0,
    width: parseFloat(el.style.width) || 0,
    height: parseFloat(el.style.height) || 0,
  };
}

function resolveAxis(axis: CapsuleAxis, from: Rect, to: Rect): "x" | "y" {
  if (axis === "x" || axis === "y") return axis;
  const dx = Math.abs(to.left + to.width / 2 - (from.left + from.width / 2));
  const dy = Math.abs(to.top + to.height / 2 - (from.top + from.height / 2));
  return dx >= dy ? "x" : "y";
}

function stretchRect(from: Rect, to: Rect, axis: "x" | "y", extra = 12): Rect {
  if (axis === "x") {
    const fromRight = from.left + from.width;
    const toRight = to.left + to.width;
    const goingPositive = to.left + to.width / 2 >= from.left + from.width / 2;
    const left = goingPositive ? from.left : to.left - extra;
    const right = goingPositive ? toRight + extra : fromRight;
    return {
      left,
      width: Math.max(right - left, Math.max(from.width, to.width)),
      top: mid(from.top, to.top),
      height: mid(from.height, to.height),
    };
  }
  const fromBottom = from.top + from.height;
  const toBottom = to.top + to.height;
  const goingPositive = to.top + to.height / 2 >= from.top + from.height / 2;
  const top = goingPositive ? from.top : to.top - extra;
  const bottom = goingPositive ? toBottom + extra : fromBottom;
  return {
    top,
    height: Math.max(bottom - top, Math.max(from.height, to.height)),
    left: mid(from.left, to.left),
    width: mid(from.width, to.width),
  };
}

function bounceRect(from: Rect, to: Rect, axis: "x" | "y"): Rect {
  const overshoot = 10;
  const squash = 0.86;
  const ortho = 1.1;
  if (axis === "x") {
    const sign = Math.sign(to.left + to.width / 2 - (from.left + from.width / 2)) || 1;
    const width = Math.max(to.width * squash, 16);
    const left = sign > 0 ? to.left + to.width + overshoot - width : to.left - overshoot;
    const height = to.height * ortho;
    return {
      left,
      width,
      top: to.top - (height - to.height) / 2,
      height,
    };
  }
  const sign = Math.sign(to.top + to.height / 2 - (from.top + from.height / 2)) || 1;
  const height = Math.max(to.height * squash, 16);
  const top = sign > 0 ? to.top + to.height + overshoot - height : to.top - overshoot;
  const width = to.width * ortho;
  return {
    top,
    height,
    left: to.left - (width - to.width) / 2,
    width,
  };
}

function isVisibleRect(rect: Rect | null): rect is Rect {
  return Boolean(rect && rect.width >= 4 && rect.height >= 4);
}

export function GlassCapsuleNav({
  activeKey,
  axis = "auto",
  className,
  children,
  as: Tag = "nav",
  "aria-label": ariaLabel,
}: GlassCapsuleNavProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const capsuleRef = useRef<HTMLSpanElement | null>(null);
  const firstPlace = useRef(true);
  const prevRect = useRef<Rect | null>(null);
  const animRef = useRef<Animation | null>(null);
  const movingRef = useRef(false);
  const axisRef = useRef(axis);
  axisRef.current = axis;

  useLayoutEffect(() => {
    const root = rootRef.current;
    const capsule = capsuleRef.current;
    if (!root || !capsule) return;

    const measure = (): Rect | null => {
      const active = root.querySelector<HTMLElement>("[data-capsule-active='true']");
      if (!active) return null;
      const cs = getComputedStyle(active);
      const rs = getComputedStyle(root);
      if (cs.display === "none" || cs.visibility === "hidden" || rs.display === "none") return null;
      const cr = root.getBoundingClientRect();
      const ar = active.getBoundingClientRect();
      if (ar.width < 4 || ar.height < 4) return null;
      return {
        left: ar.left - cr.left + root.scrollLeft,
        top: ar.top - cr.top + root.scrollTop,
        width: ar.width,
        height: ar.height,
      };
    };

    const stopAnim = () => {
      const anim = animRef.current;
      if (!anim) return;
      try {
        anim.commitStyles();
      } catch {
        /* ignore */
      }
      anim.cancel();
      animRef.current = null;
      movingRef.current = false;
    };

    const hide = () => {
      stopAnim();
      capsule.classList.remove("is-ready");
      delete capsule.dataset.ready;
      capsule.style.width = "0px";
      capsule.style.height = "0px";
      firstPlace.current = true;
      prevRect.current = null;
    };

    const snap = (rect: Rect) => {
      stopAnim();
      applyRect(capsule, rect);
      capsule.classList.add("is-ready");
      prevRect.current = rect;
      firstPlace.current = false;
    };

    const move = (from: Rect, to: Rect) => {
      stopAnim();
      applyRect(capsule, from);
      capsule.classList.add("is-ready");
      if (prefersReducedMotion()) {
        const anim = capsule.animate([toKeyframes(from), toKeyframes(to)], {
          duration: REDUCE_MS,
          easing: "ease",
          fill: "forwards",
        });
        animRef.current = anim;
        movingRef.current = true;
        anim.finished
          .then(() => {
            if (animRef.current !== anim) return;
            try {
              anim.commitStyles();
            } catch {
              /* ignore */
            }
            anim.cancel();
            applyRect(capsule, to);
            animRef.current = null;
            movingRef.current = false;
          })
          .catch(() => {
            if (animRef.current === anim) {
              animRef.current = null;
              movingRef.current = false;
            }
          });
        prevRect.current = to;
        return;
      }

      const travel = resolveAxis(axisRef.current, from, to);
      const stretch = stretchRect(from, to, travel);
      const bounce = bounceRect(from, to, travel);
      const anim = capsule.animate(
        [
          { ...toKeyframes(from), offset: 0, easing: "cubic-bezier(0.22, 0.08, 0.25, 1)" },
          { ...toKeyframes(stretch), offset: 0.4, easing: "cubic-bezier(0.2, 0.85, 0.25, 1)" },
          { ...toKeyframes(bounce), offset: 0.72, easing: "cubic-bezier(0.34, 1.65, 0.46, 1)" },
          { ...toKeyframes(to), offset: 1 },
        ],
        { duration: MOVE_MS, fill: "forwards" },
      );
      animRef.current = anim;
      movingRef.current = true;
      anim.finished
        .then(() => {
          if (animRef.current !== anim) return;
          try {
            anim.commitStyles();
          } catch {
            /* ignore */
          }
          anim.cancel();
          applyRect(capsule, to);
          animRef.current = null;
          movingRef.current = false;
        })
        .catch(() => {
          if (animRef.current === anim) {
            animRef.current = null;
            movingRef.current = false;
          }
        });
      prevRect.current = to;
    };

    const placeForNav = () => {
      const rect = measure();
      if (!isVisibleRect(rect)) return false;
      const prev = prevRect.current;
      if (firstPlace.current || !prev) {
        snap(rect);
        return true;
      }
      if (sameRect(prev, rect)) return true;
      const from = movingRef.current ? readRect(capsule) : prev;
      move(from, rect);
      return true;
    };

    const placeForLayout = () => {
      if (movingRef.current) return;
      const rect = measure();
      if (!isVisibleRect(rect)) return;
      snap(rect);
    };

    placeForNav();

    const retryTimers = RETRY_MS.map((ms) =>
      window.setTimeout(() => {
        if (!capsule.classList.contains("is-ready")) placeForNav();
        else placeForLayout();
      }, ms),
    );

    const ro = new ResizeObserver(() => placeForLayout());
    ro.observe(root);
    const active = root.querySelector<HTMLElement>("[data-capsule-active='true']");
    if (active) ro.observe(active);

    const mo = new MutationObserver((records) => {
      if (movingRef.current) return;
      const relevant = records.some((r) => r.target !== capsule && !capsule.contains(r.target));
      if (!relevant) return;
      placeForLayout();
      const next = root.querySelector<HTMLElement>("[data-capsule-active='true']");
      if (next) ro.observe(next);
    });
    mo.observe(root, {
      childList: true,
      subtree: true,
      attributeFilter: ["data-capsule-active"],
    });

    const onResize = () => placeForLayout();
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => placeForLayout();
    media.addEventListener("change", onMotion);

    root.addEventListener("scroll", onResize, { passive: true });

    return () => {
      retryTimers.forEach((id) => window.clearTimeout(id));
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      media.removeEventListener("change", onMotion);
      root.removeEventListener("scroll", onResize);
      if (movingRef.current) prevRect.current = readRect(capsule);
      stopAnim();
    };
  }, [activeKey]);

  return (
    <Tag
      ref={(node: HTMLElement | null) => {
        rootRef.current = node;
      }}
      className={cn("glass-capsule-nav", className)}
      aria-label={ariaLabel}
    >
      <span ref={capsuleRef} className="glass-capsule" aria-hidden="true" data-glass-capsule="" />
      {children}
    </Tag>
  );
}
