"use client";

import { useEffect } from "react";
import { track } from "@/lib/telemetry";

export default function TelemetryPing({ name, payload }: { name: string; payload?: Record<string, unknown> }) {
  useEffect(() => {
    track(name, payload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

