import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { DeleteAccountButton } from "./DeleteAccountButton";

export const dynamic = "force-dynamic";

export default async function DataDeletionPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">User Data Deletion</h1>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">How to Delete Your Data</h2>
        <p>
          LT Grocery is a self-hosted application. All your data is stored
          exclusively on the server where the application is installed.
        </p>
        <p>You have two options to delete your data:</p>
        <ol className="list-decimal list-inside space-y-2 ml-2">
          <li>
            <strong>Delete your account below</strong> — Removes your profile,
            grocery lists, and preferences from the database.
          </li>
          <li>
            <strong>Contact the server administrator</strong> — The person who
            installed LT Grocery can manually remove your data.
          </li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">What Gets Deleted</h2>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Your user profile (name, email, avatar)</li>
          <li>All your grocery lists and items</li>
          <li>Your connected Google / Facebook accounts</li>
          <li>Your language and theme preferences</li>
          <li>Your device session history</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Scraped product data and store information (public data) are not
          affected.
        </p>
      </section>

      {session ? (
        <DeleteAccountButton />
      ) : (
        <div className="p-4 rounded-lg border bg-muted text-sm">
          <a href="/login" className="text-primary hover:underline font-medium">
            Sign in
          </a>{" "}
          to delete your account.
        </div>
      )}
    </div>
  );
}
