import { NextRequest, NextResponse } from "next/server";
import Runway from "@runwayml/sdk";

/**
 * Mints a Runway realtime session for the SHARED admin stylist character.
 *
 * Uses the official @runwayml/sdk — the raw fetch path stays at NOT_READY
 * forever (some protocol detail the SDK handles for us). The SDK reaches
 * READY in ~1-2s and returns a `sessionKey` we forward to the client.
 *
 * The character is configured server-side via STYLIST_CHARACTER_ID env var
 * (created once via `python -m scripts.setup_admin_stylist`). Every user gets
 * the same stylist — it's a brand asset, not per-user.
 */
export async function POST(_request: NextRequest) {
  const apiKey = process.env.RUNWAYML_API_SECRET || process.env.RUNWAY_API_KEY;
  const avatarId = process.env.STYLIST_CHARACTER_ID;

  if (!apiKey) {
    return NextResponse.json({ error: "Missing RUNWAYML_API_SECRET" }, { status: 500 });
  }
  if (!avatarId) {
    return NextResponse.json(
      {
        error:
          "Stylist not configured. Run `python -m scripts.setup_admin_stylist` and add STYLIST_CHARACTER_ID to frontend/.env.local.",
      },
      { status: 503 }
    );
  }

  const client = new Runway({ apiKey });

  let sessionId: string;
  try {
    const created = await client.realtimeSessions.create({
      model: "gwm1_avatars",
      avatar: { type: "custom", avatarId },
    });
    sessionId = created.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Session creation failed: ${msg}` }, { status: 502 });
  }

  // Poll until READY. The SDK gets there in ~1-2s; 30s is generous.
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    let session;
    try {
      session = await client.realtimeSessions.retrieve(sessionId);
    } catch {
      // Transient fetch glitch — try again after a short sleep
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }

    if (session.status === "READY" && session.sessionKey) {
      return NextResponse.json({ sessionId, sessionKey: session.sessionKey });
    }

    if (session.status === "FAILED" || session.status === "CANCELLED" || session.status === "COMPLETED") {
      return NextResponse.json(
        { error: `Session ${session.status.toLowerCase()} before becoming ready` },
        { status: 502 }
      );
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  return NextResponse.json({ error: "Session never became READY" }, { status: 504 });
}
