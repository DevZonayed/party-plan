// Parse pack quantity from a product title, e.g. "Red Plates | 50 Count" -> 50.
// This is critical: without it the AI would recommend 3 packs of plates for a
// 20-guest party (150 plates). Parsing the count lets it reason correctly.
const PATTERNS: RegExp[] = [
  /\|\s*(\d{1,4})\s*(?:count|ct|pcs|pieces|pk|pack)\b/i,
  /\((\d{1,4})\s*(?:count|ct|pcs|pieces|pk|pack)\)/i,
  /\b(\d{1,4})\s*(?:count|ct|pcs|pieces|pk|pack)\b/i,
  /\bset\s*of\s*(\d{1,4})\b/i,
  /\bpack\s*of\s*(\d{1,4})\b/i,
  /\((\d{1,4})\s*pack\)/i,
  /\b(\d{1,4})\s*pk\b/i,
];

export function parsePackQuantity(title: string): number | null {
  for (const re of PATTERNS) {
    const m = re.exec(title);
    if (m && m[1]) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > 0 && n <= 10000) return n;
    }
  }
  return null;
}

export function unitLabel(packQuantity: number | null, quantity: number) {
  if (!packQuantity || packQuantity <= 1) {
    return quantity === 1 ? "1 unit" : quantity + " units";
  }
  const totalUnits = packQuantity * quantity;
  return quantity + " x " + packQuantity + "-pack (" + totalUnits + " total)";
}
