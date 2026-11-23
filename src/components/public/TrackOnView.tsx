"use client";

import { useEffect } from "react";
import { trackEvent } from "./TrackInit";

export function TrackOnView({
  event,
  params,
}: {
  event: "ViewContent" | "InitiateCheckout" | "Purchase";
  params?: Record<string, unknown>;
}) {
  useEffect(() => {
    trackEvent(event, params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);
  return null;
}
