import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: April 2026</p>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">1. Data We Collect</h2>
        <p>
          When you sign in with Google or Facebook, we receive your name, email
          address, and profile picture from the provider. We store this in our
          database to identify your account.
        </p>
        <p>
          We store the grocery lists you create — item names, quantities, and
          pinned products. Your language and theme preferences are saved locally
          in your account.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">2. How We Use Your Data</h2>
        <p>
          Your data is used exclusively to provide the LT Grocery service:
          displaying your grocery lists, comparing prices across stores, and
          syncing your lists between your devices.
        </p>
        <p>We do not share your data with third parties. We do not sell your data.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">3. Data Storage</h2>
        <p>
          All data is stored on the server where LT Grocery is installed. No data
          is sent to external analytics services. Your session is managed via a
          secure JWT token stored in your browser.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">4. Your Rights</h2>
        <p>You can delete your account and all associated data at any time.</p>
        {session ? (
          <p>
            You are currently signed in as <strong>{session.user.email}</strong>.
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">5. Contact</h2>
        <p>
          LT Grocery is self-hosted. For privacy concerns, contact the server
          administrator.
        </p>
      </section>
    </div>
  );
}
