import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

function prismaQueryCompilerWasm(): Plugin {
  return {
    name: "cortex-prisma-query-compiler-wasm",
    apply: "build",
    generateBundle() {
      const candidates = [
        path.resolve("node_modules/.prisma/client/query_compiler_bg.wasm"),
        path.resolve("src/generated/prisma/query_compiler_bg.wasm"),
        path.resolve("src/generated/prisma/internal/query_compiler_bg.wasm"),
      ];
      const wasmPath = candidates.find((candidate) => fs.existsSync(candidate));
      if (!wasmPath) {
        this.error(
          "Prisma query compiler WASM was not found after prisma generate. Expected query_compiler_bg.wasm in generated Prisma output."
        );
        return;
      }

      this.emitFile({
        type: "asset",
        fileName: "node_modules/.prisma/client/query_compiler_bg.wasm",
        source: fs.readFileSync(wasmPath),
      });
    },
  };
}

export default defineConfig({
  plugins: [
    vinext(),
    prismaQueryCompilerWasm(),
    cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
    }),
  ],
});
