import { headers } from "next/headers";

import ChatlayaClient from "./ChatlayaClient";

const CHATLAYA_AUTONOMOUS_HOST = "chatlaya.innovaplus.africa";

export default async function ChatlayaPage() {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-koryxa-host") ||
    requestHeaders.get("x-forwarded-host") ||
    requestHeaders.get("host") ||
    "";
  const normalizedHost = host.split(":")[0];
  const initialAutonomousHost = normalizedHost === CHATLAYA_AUTONOMOUS_HOST;

  return <ChatlayaClient initialAutonomousHost={initialAutonomousHost} />;
}
