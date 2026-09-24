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

async function promptValue(rl, name, required = true) {
  const suffix = required ? " (required)" : " (optional; Enter to skip)";
  const value = await rl.question(name + suffix + ": ");
  if (!value.trim()) {
    if (required) throw new Error(name + " is required.");
    return "";
  }
  return value.trim();
}

async function promptSecret(rl, name, required = true) {
  const value = await promptValue(rl, name, required);
  if (value) await putSecret(name, value);
}

async function main() {
  console.log("\nCortex AI → Cloudflare Workers setup\n");

  console.log("1) Opening Cloudflare login...");
  await run("npx", ["wrangler", "login"], { interactive: true });

  console.log("2) Verifying Cloudflare access...");
  await run("npx", ["wrangler", "whoami"], { interactive: true });

  console.log("3) Ensuring the production R2 bucket exists...");
  await run("npx", ["wrangler", "r2", "bucket", "info", bucketName, "--json"]).catch(async () => {
    await run("npx", ["wrangler", "r2", "bucket", "create", bucketName]);
  });

  const rl = createInterface({ input, output });
  let appPublicUrl = "";
  try {
    console.log("\nEnter the runtime secrets. They are sent directly to Cloudflare and are not written to Git.\n");
    await promptSecret(rl, "DATABASE_URL");
    await promptSecret(rl, "APP_SECRET_KEY");
    await promptSecret(rl, "CORTEX_ADMIN_USERNAME");
    await promptSecret(rl, "CORTEX_ADMIN_PASSWORD");
    await promptSecret(rl, "CORTEX_ADMIN_SESSION_SECRET");
    await promptSecret(rl, "R2_ACCOUNT_ID");
    await putSecret("R2_BUCKET_NAME", bucketName);
    await promptSecret(rl, "R2_ACCESS_KEY_ID");
    await promptSecret(rl, "R2_SECRET_ACCESS_KEY");
    await promptSecret(rl, "OPENAI_API_KEY", false);
    await promptSecret(rl, "EMBEDDINGS_MODEL", false);
    await promptSecret(rl, "EMBEDDINGS_BASE_URL", false);
    await promptSecret(rl, "QDRANT_URL", false);
    await promptSecret(rl, "QDRANT_API_KEY", false);
    appPublicUrl = await promptValue(rl, "APP_PUBLIC_URL", false);
    if (appPublicUrl) await putSecret("APP_PUBLIC_URL", appPublicUrl);
    await promptSecret(rl, "TELEGRAM_INTERNAL_SECRET", false);
  } finally {
    rl.close();
  }

  console.log("\n3.5) Configuring private R2 CORS for the application origin...");
  const corsOrigins = ["https://cortex-ai.dengxiao445.workers.dev"];
  if (appPublicUrl) {
    const normalized = appPublicUrl.replace(/\/$/, "");
    if (/^https:\/\//i.test(normalized) && !corsOrigins.includes(normalized)) corsOrigins.push(normalized);
  }
  const fs = await import("node:fs/promises");
  const corsFile = process.cwd() + "/.cortex-r2-cors.json";
  await fs.writeFile(corsFile, JSON.stringify({
    rules: [{
      allowed: {
        origins: corsOrigins,
        methods: ["PUT", "GET", "HEAD"],
        headers: ["Content-Type"],
      },
      exposeHeaders: ["ETag"],
      maxAgeSeconds: 3600,
    }],
  }, null, 2), "utf8");
  try {
    await run("npx", ["wrangler", "r2", "bucket", "cors", "set", bucketName, "--file", corsFile, "--force"]);
    console.log("R2 CORS policy configured for: " + corsOrigins.join(", "));
  } finally {
    await fs.rm(corsFile, { force: true });
  }

  console.log("\n4) Building and deploying Cortex AI...");
  await run("npx", ["@vinext/cloudflare", "deploy"], { interactive: true });

  console.log("\nCortex AI deployment finished.");
}

main().catch((error) => {
  console.error("\nSetup failed:", error.message);
  process.exit(1);
});
