// Minimal, dependency-free Markdown helpers for rendering agent output. The inline
// parser is pure and unit-tested; block handling lives in the Markdown component.

export interface InlineToken {
  readonly text: string;
  readonly bold?: boolean;
  readonly code?: boolean;
}

const INLINE_PATTERN = /(`[^`]+`|\*\*[^*]+\*\*)/g;

/** Split a line into plain / bold (**...**) / inline-code (`...`) tokens. */
export function parseInline(line: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  INLINE_PATTERN.lastIndex = 0;
  while ((match = INLINE_PATTERN.exec(line)) !== null) {
    if (match.index > lastIndex) tokens.push({ text: line.slice(lastIndex, match.index) });
    const token = match[0];
    if (token.startsWith("`")) tokens.push({ text: token.slice(1, -1), code: true });
    else tokens.push({ text: token.slice(2, -2), bold: true });
    lastIndex = INLINE_PATTERN.lastIndex;
  }
  if (lastIndex < line.length) tokens.push({ text: line.slice(lastIndex) });
  return tokens.length > 0 ? tokens : [{ text: line }];
}

export type BlockType = "heading1" | "heading2" | "heading3" | "bullet" | "ordered" | "paragraph";

export interface MarkdownBlock {
  readonly type: BlockType;
  readonly text: string;
  /** Ordered-list marker, e.g. "1." */
  readonly marker?: string;
  readonly code?: boolean;
}

/** Truncate long text to a preview at a line boundary, appending an ellipsis. */
export function previewText(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastBreak = slice.lastIndexOf("\n");
  const cut = lastBreak > max * 0.5 ? slice.slice(0, lastBreak) : slice;
  return `${cut.trimEnd()}\n…`;
}

/** Classify a single (non-fence) line into a block descriptor. */
export function classifyLine(line: string): MarkdownBlock {
  const heading = /^(#{1,3})\s+(.*)$/.exec(line);
  if (heading) {
    const level = heading[1].length;
    return { type: level === 1 ? "heading1" : level === 2 ? "heading2" : "heading3", text: heading[2] };
  }
  const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
  if (bullet) return { type: "bullet", text: bullet[1] };
  const ordered = /^\s*(\d+)\.\s+(.*)$/.exec(line);
  if (ordered) return { type: "ordered", text: ordered[2], marker: `${ordered[1]}.` };
  return { type: "paragraph", text: line };
}
