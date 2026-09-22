import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const bucketName = "cortex-ai-knowledge";

function run(command, args, { inputData = null, interactive = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: process.platform === "win32",
      stdio: interactive ? "inherit" : ["pipe", "inherit", "inherit"],
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(code);
      else reject(new Error(command + " exited with code " + code));
    });

    if (inputData !== null && child.stdin) {
      child.stdin.write(inputData);
      child.stdin.end();
    }
  });
}

async function putSecret(name, value) {
  await run("npx", ["wrangler", "secret", "put", name], {
    inputData: value.trim() + "\n",
  });
}

async function promptSecret(rl, name, required = true) {
  const suffix = required ? " (required)" : " (optional; Enter to skip)";
  const value = await rl.question(name + suffix + ": ");
  if (!value.trim()) {
    if (required) throw new Error(name + " is required.");
    return;
  }
  await putSecret(name, value);
}

async function main() {
  console.log("\nCortex AI → Cloudflare Workers setup\n");

  console.log("1) Opening Cloudflare login...");
  await run("npx", ["wrangler", "login"], { interactive: true });

  console.log("2) Verifying Cloudflare access...");
  await run("npx", ["wrangler", "whoami"], { interactive: true });

  console.log("3) Ensuring R2 bucket exists: " + bucketName);
  const listCode = await run("npx", ["wrangler", "r2", "bucket", "list"], { interactive: true });
  if (listCode !== 0) throw new Error("Could not access Cloudflare R2.");

  try {
    await run("npx", ["wrangler", "r2", "bucket", "create", bucketName], { interactive: true });
    console.log("R2 bucket created.");
  } catch {
    console.log("R2 bucket already exists or could not be created; continuing.");
  }

  const rl = createInterface({ input, output });
  try {
    console.log("\nEnter the runtime secrets. They are sent directly to Cloudflare and are not written to Git.\n");
    await promptSecret(rl, "DATABASE_URL");
    await promptSecret(rl, "APP_SECRET_KEY");
    await promptSecret(rl, "CORTEX_ADMIN_PASSWORD");
    await promptSecret(rl, "CORTEX_ADMIN_SESSION_SECRET");
    await promptSecret(rl, "OPENAI_API_KEY", false);
    await promptSecret(rl, "EMBEDDINGS_MODEL", false);
    await promptSecret(rl, "EMBEDDINGS_BASE_URL", false);
    await promptSecret(rl, "QDRANT_URL", false);
    await promptSecret(rl, "QDRANT_API_KEY", false);
    await promptSecret(rl, "APP_PUBLIC_URL", false);
  } finally {
    rl.close();
  }

  console.log("\n4) Building and deploying Cortex AI...");
  await run("npx", ["@vinext/cloudflare", "deploy"], { interactive: true });

  console.log("\nCortex AI deployment finished.");
}

main().catch((error) => {
  console.error("\nSetup failed:", error.message);
  process.exit(1);
});
