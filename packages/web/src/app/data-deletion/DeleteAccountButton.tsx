"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";

export function DeleteAccountButton() {
  const [step, setStep] = useState<"confirm" | "deleting" | "done">("confirm");

  const handleDelete = async () => {
    setStep("deleting");
    const res = await fetch("/api/delete-account", { method: "POST" });
    if (res.ok) {
      setStep("done");
      signOut({ callbackUrl: "/" });
    }
  };

  if (step === "done") {
    return (
      <p className="text-sm text-green-600 dark:text-green-400">
        Account deleted. Redirecting...
      </p>
    );
  }

  return (
    <div className="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 space-y-3">
      <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
        <AlertTriangle className="h-5 w-5" />
        <span className="font-semibold">This action is irreversible</span>
      </div>
      <p className="text-sm text-red-600 dark:text-red-400">
        All your grocery lists, preferences, and account data will be permanently
        deleted.
      </p>
      <Button
        variant="destructive"
        disabled={step === "deleting"}
        onClick={handleDelete}
        className="gap-2"
      >
        {step === "deleting" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Deleting...
          </>
        ) : (
          <>
            <Trash2 className="h-4 w-4" />
            Delete My Account
          </>
        )}
      </Button>
    </div>
  );
}
