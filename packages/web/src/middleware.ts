import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

function parseDeviceName(ua: string | null): string {
  if (!ua) return "Unknown Device";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Macintosh|Mac OS X/i.test(ua)) return "Mac";
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return "Linux";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/CrOS/i.test(ua)) return "Chromebook";
  return "Unknown Device";
}

export default withAuth(
  async function middleware(req) {
    const userAgent = req.headers.get("user-agent");
    const deviceName = parseDeviceName(userAgent);

    const res = NextResponse.next();

    if (req.nextauth.token?.sub) {
      try {
        const { PrismaClient } = await import("@prisma/client");
        const prisma = new PrismaClient({
          datasourceUrl: process.env.DATABASE_URL,
        });

        await prisma.deviceSession.upsert({
          where: { userId_deviceName: { userId: req.nextauth.token.sub, deviceName } },
          update: {
            lastSeenAt: new Date(),
            userAgent: userAgent?.slice(0, 500),
          },
          create: {
            userId: req.nextauth.token.sub,
            deviceName,
            userAgent: userAgent?.slice(0, 500),
          },
        });

        await prisma.$disconnect();
      } catch {
        // best effort — don't block the request
      }
    }

    return res;
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/grocery-lists/:path*",
    "/settings/:path*",
    "/advanced-settings",
    "/category-parser",
    "/manual-enrichment",
    "/scraper",
  ],
};
