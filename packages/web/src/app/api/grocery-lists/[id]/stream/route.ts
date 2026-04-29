import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return new Response("Invalid ID", { status: 400 });
  }

  const existing = await prisma.groceryList.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!existing || existing.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      while (!closed) {
        try {
          const list = await prisma.groceryList.findUnique({
            where: { id },
            select: { version: true, updatedAt: true },
          });
          if (list) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ version: list.version, updatedAt: list.updatedAt })}\n\n`
              )
            );
          }
        } catch {
          // DB error, keep trying
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    },
    cancel() {
      closed = true;
    },
  });

  req.signal.addEventListener("abort", () => {
    closed = true;
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
