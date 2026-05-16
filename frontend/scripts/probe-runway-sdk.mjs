// Smoke test: does the official @runwayml/sdk give us a working session?
import Runway from "@runwayml/sdk";
import fs from "node:fs";
import path from "node:path";

// Read frontend/.env.local manually (no dotenv in this script env)
const envText = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const apiKey = process.env.RUNWAYML_API_SECRET || process.env.RUNWAY_API_KEY;
const avatarId = process.env.STYLIST_CHARACTER_ID;
if (!apiKey) { console.error("No RUNWAYML_API_SECRET"); process.exit(1); }
if (!avatarId) { console.error("No STYLIST_CHARACTER_ID"); process.exit(1); }

const client = new Runway({ apiKey });

console.log("Creating session for avatarId:", avatarId);
const start = Date.now();
const { id: sessionId } = await client.realtimeSessions.create({
  model: "gwm1_avatars",
  avatar: { type: "custom", avatarId },
});
console.log(`[${(Date.now() - start)}ms] Created sessionId=${sessionId}`);

for (let i = 0; i < 40; i++) {
  const s = await client.realtimeSessions.retrieve(sessionId);
  const elapsed = Date.now() - start;
  console.log(`[${elapsed}ms] status=${s.status}${s.sessionKey ? " sessionKey=YES" : ""}`);
  if (s.status === "READY") {
    console.log("FINAL session shape:", JSON.stringify(s, null, 2));
    process.exit(0);
  }
  if (["FAILED", "COMPLETED", "CANCELLED"].includes(s.status)) {
    console.error("Terminal status before READY:", s.status);
    process.exit(2);
  }
  await new Promise(r => setTimeout(r, 1500));
}
console.error("Never reached READY within 60s");
process.exit(3);
