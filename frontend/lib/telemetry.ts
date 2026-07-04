export type TelemetryEvent = {
  name: string;
  payload?: Record<string, unknown>;
};

export async function track(name: string, payload?: Record<string, unknown>) {
  const evt: TelemetryEvent = { name, payload };
  const base = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_CHATLAYA_URL || "").replace(/\/+$/, "");
  try {
    if (base) {
      await fetch(`${base}/telemetry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(evt),
        keepalive: true,
      });
    } else {
      console.debug("telemetry", evt);
    }
  } catch {
    console.debug("telemetry-fail", evt);
  }
}
