import { afterEach, describe, expect, test } from "vitest";
import { chunkInputs } from "@/lib/knowledge/chunk";

const originalSize = process.env.CHUNK_SIZE;
const originalOverlap = process.env.CHUNK_OVERLAP;

afterEach(() => {
  if (originalSize === undefined) delete process.env.CHUNK_SIZE;
  else process.env.CHUNK_SIZE = originalSize;
  if (originalOverlap === undefined) delete process.env.CHUNK_OVERLAP;
  else process.env.CHUNK_OVERLAP = originalOverlap;
});

describe("knowledge chunking", () => {
  test("preserves source page/section metadata and sequence", () => {
    process.env.CHUNK_SIZE = "40";
    process.env.CHUNK_OVERLAP = "5";

    const chunks = chunkInputs([
      { text: "اولین پاراگراف کوتاه.", page: 3, section: "قیمت‌ها" },
      { text: "پاراگراف دوم که باید جدا بماند.", page: 4, section: "مشخصات" },
    ]);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((chunk) => chunk.seq)).toEqual(chunks.map((_, i) => i));
    expect(chunks.some((chunk) => chunk.page === 3 && chunk.section === "قیمت‌ها")).toBe(true);
    expect(chunks.some((chunk) => chunk.page === 4 && chunk.section === "مشخصات")).toBe(true);
  });

  test("splits oversized sentences without dropping content", () => {
    process.env.CHUNK_SIZE = "300";
    process.env.CHUNK_OVERLAP = "60";

    const source = "الف".repeat(730);
    const chunks = chunkInputs([{ text: source, page: 1 }]);

    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((chunk) => chunk.text.length <= 300)).toBe(true);
    expect(chunks.map((chunk) => chunk.text).join("").length).toBeGreaterThanOrEqual(730);
  });
});
