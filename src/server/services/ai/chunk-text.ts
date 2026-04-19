export function chunkText(
  text: string,
  options?: {
    chunkSize?: number;
    overlap?: number;
  }
): string[] {
  const chunkSize = options?.chunkSize ?? 1200;
  const overlap = options?.overlap ?? 200;

  const normalized = text.replace(/\r/g, "").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length);
    const slice = normalized.slice(start, end).trim();

    if (slice) {
      chunks.push(slice);
    }

    if (end === normalized.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}