import { NextRequest, NextResponse } from "next/server";

const RUNWAY_API_BASE = "https://api.runwayml.com/v1";

export async function POST(request: NextRequest) {
  const { avatarId } = await request.json();
  const apiKey = process.env.RUNWAYML_API_SECRET || process.env.RUNWAY_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing RUNWAYML_API_SECRET in frontend/.env.local" },
      { status: 500 }
    );
  }

  if (!avatarId) {
    return NextResponse.json(
      { error: "Missing avatarId in request body" },
      { status: 400 }
    );
  }

  const response = await fetch(`${RUNWAY_API_BASE}/realtime_sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Runway-Version": "2024-11-06",
    },
    body: JSON.stringify({
      model: "gwm1_avatars",
      avatar: { type: "custom", avatarId },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    return NextResponse.json(
      { error: `Runway session creation failed (${response.status}): ${errText.slice(0, 240)}` },
      { status: response.status }
    );
  }

  const data = await response.json();
  return NextResponse.json(data);
}
