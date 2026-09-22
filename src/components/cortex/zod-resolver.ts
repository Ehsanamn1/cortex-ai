"use client";

import type { FieldValues, Resolver } from "react-hook-form";
import type { z } from "zod";

/**
 * Minimal zod → react-hook-form resolver (works with zod v3/v4 `issues` shape).
 * Maps the first issue per field path to RHF errors.
 */
export function zodResolver<T extends FieldValues>(schema: z.ZodType<T>): Resolver<T> {
  return async (values) => {
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data, errors: {} };
    }
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".");
      if (key && !errors[key]) {
        errors[key] = { type: issue.code ?? "validation", message: issue.message };
      }
    }
    return { values: {}, errors: errors as never };
  };
}
