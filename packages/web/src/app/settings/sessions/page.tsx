"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Monitor, Smartphone, Tablet, Loader2, Trash2 } from "lucide-react";

interface DeviceSession {
  id: string;
  deviceName: string;
  userAgent: string | null;
  lastSeenAt: string;
  createdAt: string;
}

function deviceIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("iphone") || lower.includes("android") || lower.includes("mobile")) {
    return <Smartphone className="h-4 w-4" />;
  }
  if (lower.includes("ipad") || lower.includes("tablet")) {
    return <Tablet className="h-4 w-4" />;
  }
  return <Monitor className="h-4 w-4" />;
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function SessionsPage() {
  const { t } = useI18n();
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then(setDevices)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const removeDevice = async (deviceId: string) => {
    setRemoving(deviceId);
    await fetch("/api/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId }),
    });
    setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    setRemoving(null);
  };

  return (
    <div className="max-w-xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Monitor className="h-5 w-5" />
            {t("settings.sessions") || "Active Sessions"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : devices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No session history yet.
            </p>
          ) : (
            <div className="space-y-3">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {deviceIcon(device.deviceName)}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {device.deviceName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {timeAgo(device.lastSeenAt)}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {timeAgo(device.lastSeenAt) === "just now"
                      ? t("settings.activeNow") || "Active now"
                      : t("settings.lastActive") || "Last active"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={removing === device.id}
                    onClick={() => removeDevice(device.id)}
                    aria-label="Remove device"
                  >
                    {removing === device.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
