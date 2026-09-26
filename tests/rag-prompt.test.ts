import { describe, expect, test } from "vitest";
import { buildRagMessages } from "@/lib/rag/prompt";

describe("grounded RAG prompt", () => {
  test("includes bounded long-term memory as context, not as factual knowledge", () => {
    const messages = buildRagMessages({
      persona: {
        name: "Cortex",
        language: "fa",
        tone: "professional",
      },
      memory: [
        { key: "user_name", value: "احسان" },
        { key: "preferred_language", value: "فارسی" },
      ],
      retrieved: [
        {
          index: 1,
          documentName: "pricing.txt",
          page: null,
          sourceUrl: null,
          text: "قیمت پلن پایه ۱۰ دلار است.",
          score: 0.9,
        },
      ],
      history: [],
      question: "قیمت پلن پایه چقدر است؟",
    });

    const system = messages.filter((message) => message.role === "system").map((message) => message.content).join("\n");

    expect(system).toContain("احسان");
    expect(system).toContain("قیمت پلن پایه ۱۰ دلار");
    expect(system).toContain("نباید برای ادعای factual مستقل استفاده شود");
  });
});
