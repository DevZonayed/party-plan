import { hueFromString } from "@/lib/utils";

// Colorful placeholder art for products/themes (used until real merchant
// images are ingested). Deterministic gradient from a seed string + emoji.
export function ProductTile({
  seed,
  emoji,
  label,
  className,
  size = "md",
}: {
  seed: string;
  emoji: string;
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const h = hueFromString(seed);
  const emojiSize = size === "lg" ? "text-6xl" : size === "sm" ? "text-2xl" : "text-4xl";
  return (
    <div
      className={"relative flex items-center justify-center overflow-hidden rounded-xl " + (className ?? "")}
      style={{
        background:
          "linear-gradient(135deg, hsl(" + h + ",80%,90%), hsl(" + ((h + 50) % 360) + ",80%,80%))",
      }}
    >
      <div className={"select-none " + emojiSize} aria-hidden>
        {emoji}
      </div>
      {label ? (
        <span className="absolute bottom-1 left-1 right-1 truncate rounded bg-white/70 px-1 text-[10px] font-medium text-foreground/70">
          {label}
        </span>
      ) : null}
    </div>
  );
}

export function ThemeTile({ seed, emoji, heroColor }: { seed: string; emoji: string; heroColor: string }) {
  const h = hueFromString(seed);
  return (
    <div
      className="relative flex h-40 w-full items-center justify-center overflow-hidden rounded-2xl"
      style={{
        background:
          "linear-gradient(135deg, " + heroColor + ", hsl(" + h + ",75%,72%))",
      }}
    >
      <span className="text-6xl drop-shadow-sm" aria-hidden>
        {emoji}
      </span>
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/20 blur-xl" />
    </div>
  );
}
