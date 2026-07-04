import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ ok: false, error: "missing_url" }, { status: 400 });
  }

  const target = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`;

  try {
    const resp = await fetch(target, { method: "GET", cache: "no-store" });
    if (!resp.ok) {
      return NextResponse.json({ ok: false }, { status: 200 });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
