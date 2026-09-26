import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { AsyncLocalStorage } from "node:async_hooks";

type PrismaStore = PrismaClient;

const prismaRequestStorage = new AsyncLocalStorage<PrismaStore>();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export function createPrisma(): PrismaClient {
  const connectionString =
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim() ||
    process.env.POSTGRES_URL?.trim();

  if (!connectionString) {
    throw new Error("A Postgres connection string is not configured.");
  }

  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

function createDevelopmentPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrisma();
  }
  return globalForPrisma.prisma;
}

/**
 * Run the application request inside a request-local Prisma context.
 *
 * Cloudflare Workers isolates can serve multiple concurrent requests from the
 * same module instance. Prisma's Neon adapter creates native I/O objects that
 * cannot be shared across those requests, so a module-global Prisma client is
 * not safe in production.
 */
export function withPrismaRequest<T>(fn: () => T): T {
  return prismaRequestStorage.run(createPrisma(), fn);
}

function currentPrisma(): PrismaClient {
  const requestPrisma = prismaRequestStorage.getStore();
  if (requestPrisma) return requestPrisma;

  // Keep local Node/Vite development ergonomic. Production must always enter
  // through the Cloudflare Worker request wrapper above.
  if (process.env.NODE_ENV !== "production") {
    return createDevelopmentPrisma();
  }

  throw new Error("Prisma client accessed outside a request context.");
}

/**
 * Compatibility proxy: existing server modules can keep using db.user...
 * while the underlying Prisma client is request-scoped.
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = currentPrisma();
    const value = Reflect.get(client as unknown as object, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
