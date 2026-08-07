import "server-only";

// Minimal, safe markdown renderer for seed articles (trusted editorial
// content we author ourselves). Supports ##/### headings, paragraphs,
// **bold**, *italic*, [links](url), - lists, > blockquotes, `code`.
function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s: string) {
  return escapeHtml(s)
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" rel="noopener nofollow" class="text-brand-600 underline underline-offset-2 hover:text-brand-700">$1</a>'
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, '<code class="rounded bg-brand-50 px-1 py-0.5 text-sm">$1</code>');
}

function hTag(level: number, inner: string) {
  const cls = "mt-6 mb-2 font-bold text-foreground";
  return "<h" + level + ' class="' + cls + '">' + inner + "</h" + level + ">";
}

export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      closeList();
      continue;
    }
    const h = /^(#{2,4})\s+(.*)$/.exec(line);
    if (h) {
      closeList();
      out.push(hTag(h[1].length, inline(h[2])));
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        out.push('<ul class="my-3 ml-5 list-disc space-y-1">');
        inList = true;
      }
      out.push("<li>" + inline(line.replace(/^[-*]\s+/, "")) + "</li>");
      continue;
    }
    if (/^>\s?/.test(line)) {
      closeList();
      out.push(
        '<blockquote class="my-4 border-l-4 border-brand-300 bg-brand-50 px-4 py-2 italic">' +
          inline(line.replace(/^>\s?/, "")) +
          "</blockquote>"
      );
      continue;
    }
    closeList();
    out.push('<p class="my-3 leading-relaxed">' + inline(line) + "</p>");
  }
  closeList();
  return out.join("\n");
}
