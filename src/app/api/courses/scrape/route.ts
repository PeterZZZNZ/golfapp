import { NextResponse } from "next/server";
import { scrapeCourse } from "@/lib/scraper";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const url = body?.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "Missing 'url'" }, { status: 400 });
  }
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "Only http(s) URLs allowed" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Malformed URL" }, { status: 400 });
  }

  try {
    const result = await scrapeCourse(url);
    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: (e as Error).message || "Scraping failed" },
      { status: 500 }
    );
  }
}
