import { describe, expect, test } from "vitest";
import { formatCountCompact, formatTomanCompact } from "@/components/cortex/format";

describe("Cortex readable amount formatting", () => {
  test("uses تومان units instead of long zero strings", () => {
    expect(formatTomanCompact(7_500)).toContain("هزار تومان");
    expect(formatTomanCompact(5_900_000)).toContain("میلیون تومان");
    expect(formatTomanCompact(1_250_000_000)).toContain("میلیارد تومان");
  });

  test("keeps compact counts readable", () => {
    expect(formatCountCompact(12_500)).toContain("هزار");
    expect(formatCountCompact(2_500_000)).toContain("میلیون");
  });
});
