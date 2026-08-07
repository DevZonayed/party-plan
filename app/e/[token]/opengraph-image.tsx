import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "You're invited";

export default async function Image(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const event = await prisma.event.findUnique({
    where: { token },
    include: { theme: true },
  });
  const themeName = event?.theme?.name ?? "the party";
  const emoji = event?.theme?.emoji ?? "🎉";
  const color = event?.theme?.heroColor ?? "#7c3aed";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "linear-gradient(135deg, " + color + ", #1e1b2e)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 12 }}>
          <div style={{ fontSize: 120, lineHeight: 1 }}>{emoji}</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 28, opacity: 0.9 }}>You're invited to</div>
            <div style={{ fontSize: 72, fontWeight: 800 }}>{themeName}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 32, fontSize: 30, opacity: 0.95, marginTop: 16 }}>
          {event?.partyDate ? <div>{"📅 " + new Date(event.partyDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div> : null}
          {event ? <div>{"👥 " + event.guestCount + " guests"}</div> : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 48, fontSize: 30, fontWeight: 700 }}>
          <span>🎉</span>
          <span>PartyPlan</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
