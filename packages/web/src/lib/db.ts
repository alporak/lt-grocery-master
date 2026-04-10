import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Enable WAL mode and set busy_timeout for SQLite concurrency
prisma.$executeRawUnsafe("PRAGMA journal_mode=WAL").catch(() => {});
prisma.$executeRawUnsafe("PRAGMA busy_timeout=15000").catch(() => {});
