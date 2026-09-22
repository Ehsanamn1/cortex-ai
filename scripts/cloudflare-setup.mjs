import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const bucketName = "cortex-ai-knowledge";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: process.platform === "win32", ...options });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(code) : reject(new Error(command + " exited with code " + code)));
  });
}

async function secret(name, rl, required = true) {
  const label = required ? name + " (required)" : name + " (optional, Enter to skip)";
  const value = await rl.question(label + ": ");
  if (!value.trim() && !required) return;
  if (!value.trim()) throw new Error(name + " is required.");
  await run("npx", ["wrangler", "secret", "put", name], { input: value });
}

async function main() {
  console.log("\nCortex AI → Cloudflare Workers setup\n");

  console.log("1) Opening Cloudflare login...");
  await run("npx", ["wrangler", "login"]);

  console.log("2) Verifying Cloudflare access...");
  await run("npx", ["wrangler", "whoami"]);

  console.log("3) Creating/checking R2 bucket: " + bucketName);
  try {
    await run("npx", ["wrangler", "r2", "bucket", "list"]);
  } catch {
    throw new Error("Could not access Cloudflare R2.");
  }
  try {
    await run("npx", ["wrangler", "r2", "bucket", "create", bucketName]);
    console.log("R2 bucket created.");
  } catch {
    console.log("R2 bucket may already exist; continuing.");
  }

  const rl = createInterface({ input, output });

  try {
    await secret("DATABASE_URL", rl, true);
    await secret("APP_SECRET_KEY", rl, true);
    await secret("CORTEX_ADMIN_PASSWORD", rl, true);
    await secret("CORTEX_ADMIN_SESSION_SECRET", rl, true);
    await secret("OPENAI_API_KEY", rl, false);
    await secret("EMBEDDINGS_MODEL", rl, false);
    await secret("EMBEDDINGS_BASE_URL", rl, false);
    await secret("QDRANT_URL", rl, false);
    await secret("QDRANT_API_KEY", rl, false);
    const publicUrl = await rl.question("APP_PUBLIC_URL (optional, e.g. https://cortex-ai.example.com): ");
    if (publicUrl.trim()) await secret("APP_PUBLIC_URL", { question: async () => publicUrl }, false);
  } finally {
    rl.close();
  }

  console.log("4) Deploying Cortex AI...");
  await run("npx", ["@vinext/cloudflare", "deploy"]);

  console.log("\nCortex AI deployment finished.");
}

main().catch((error) => {
  console.error("\nSetup failed:", error.message);
  process.exit(1);
});
