import { NextResponse } from "next/server";
import type { LeadPayload } from "@/lib/types";

/**
 * Forwards a completed quiz result to the Google Apps Script webhook
 * configured via GOOGLE_SHEETS_WEBHOOK_URL. Kept server-side so the sheet
 * URL never ships to the client bundle.
 */
export async function POST(request: Request) {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      { ok: false, error: "GOOGLE_SHEETS_WEBHOOK_URL is not configured" },
      { status: 500 }
    );
  }

  let payload: LeadPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid JSON body" },
      { status: 400 }
    );
  }

  try {
    const upstream = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { ok: false, error: `upstream responded ${upstream.status}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "failed to reach webhook" },
      { status: 502 }
    );
  }
}
