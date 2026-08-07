"use client";
import { useState } from "react";
export function ShareBox({ token }: { token: string }) {
  const url = (typeof window !== "undefined" ? window.location.origin : "") + "/e/" + token;
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }
  return (
    <div className="card-pp p-5">
      <p className="mb-2 font-semibold">🔗 Shareable guest page</p>
      <p className="mb-2 text-sm text-foreground/60">Send this link to guests. They RSVP and buy gifts — no account needed.</p>
      <div className="flex gap-2">
        <input readOnly value={"/e/" + token} className="input-pp flex-1 text-sm" onClick={(e) => (e.target as HTMLInputElement).select()} />
        <button onClick={copy} className="btn-secondary btn px-3 py-2 text-sm">{copied ? "Copied!" : "Copy"}</button>
      </div>
      <a href={"/e/" + token} target="_blank" rel="noopener" className="btn-ghost btn mt-2 px-3 py-2 text-sm">Open guest page ↗</a>
    </div>
  );
}
