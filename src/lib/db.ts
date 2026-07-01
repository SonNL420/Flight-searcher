import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// WAL mode lets the web process and the worker share the SQLite file safely.
const walReady = prisma
  .$queryRawUnsafe("PRAGMA journal_mode=WAL;")
  .then(() => prisma.$queryRawUnsafe("PRAGMA busy_timeout=5000;"))
  .catch(() => {
    /* pragmas are best-effort; Prisma sets sane defaults */
  });

export async function ensureDbReady(): Promise<void> {
  await walReady;
}
