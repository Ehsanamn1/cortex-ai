/**
 * Configurable text chunking with overlap.
 * Chunks never cross page/section boundaries extracted by the pipeline, so
 * page numbers and section titles stay accurate (source identity preserved).
 */

export interface ChunkInput {
  text: string;
  page?: number | null;
  section?: string | null;
}

export interface ChunkOutput {
  seq: number;
  text: string;
  page: number | null;
  section: string | null;
}

export function chunkSize(): number {
  return clampInt(process.env.CHUNK_SIZE, 1000, 300, 4000);
}

export function chunkOverlap(): number {
  const size = chunkSize();
  return clampInt(process.env.CHUNK_OVERLAP, Math.floor(size * 0.12), 0, Math.floor(size / 2));
}

function clampInt(raw: string | undefined, def: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export function chunkInputs(inputs: ChunkInput[]): ChunkOutput[] {
  const size = chunkSize();
  const overlap = chunkOverlap();
  const out: ChunkOutput[] = [];
  let seq = 0;

  for (const input of inputs) {
    const paragraphs = input.text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    let current = "";

    const push = () => {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        out.push({ seq: seq++, text: trimmed, page: input.page ?? null, section: input.section ?? null });
      }
      current = "";
    };

    for (const paragraph of paragraphs) {
      if (paragraph.length > size) {
        // Long paragraph: split on sentence boundaries with overlap, then flush.
        push();
        for (const piece of splitLongText(paragraph, size, overlap)) {
          out.push({ seq: seq++, text: piece, page: input.page ?? null, section: input.section ?? null });
        }
        continue;
      }
      if (current.length + paragraph.length + 1 > size) {
        push();
      }
      current = current.length > 0 ? `${current}\n${paragraph}` : paragraph;
    }
    push();
  }
  return out;
}

function splitLongText(text: string, size: number, overlap: number): string[] {
  const pieces: string[] = [];
  const sentences = text.split(/(?<=[.!?؟।]|\u06D4)\s+/);
  let buffer = "";
  for (const sentence of sentences) {
    if (sentence.length > size) {
      if (buffer.trim().length > 0) pieces.push(buffer.trim());
      buffer = "";
      // Hard-split a very long "sentence" with overlap windows.
      for (let i = 0; i < sentence.length; i += Math.max(1, size - overlap)) {
        pieces.push(sentence.slice(i, i + size).trim());
      }
      continue;
    }
    if (buffer.length + sentence.length + 1 > size) {
      pieces.push(buffer.trim());
      // Seed the next piece with an overlap tail of the current buffer.
      buffer = overlap > 0 ? buffer.slice(Math.max(0, buffer.length - overlap)) + " " : "";
    }
    buffer = buffer.length > 0 ? `${buffer}${sentence}` : sentence;
  }
  if (buffer.trim().length > 0) pieces.push(buffer.trim());
  return pieces.filter((p) => p.length > 0);
}
