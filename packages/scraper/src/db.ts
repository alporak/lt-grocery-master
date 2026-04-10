import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Enable WAL mode and set busy_timeout for SQLite concurrency
prisma.$executeRawUnsafe("PRAGMA journal_mode=WAL").catch(() => {});
prisma.$executeRawUnsafe("PRAGMA busy_timeout=30000").catch(() => {});

export default prisma;
