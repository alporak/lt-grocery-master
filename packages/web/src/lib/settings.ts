import { prisma } from "./db";

export type SettingsMap = Record<string, string>;

const USER_SCOPE_KEYS = new Set(["language", "theme", "address", "lat", "lng"]);

export async function getSettings(userId?: string | null): Promise<SettingsMap> {
  const [sysRows, userRows] = await Promise.all([
    prisma.settings.findMany(),
    userId
      ? prisma.userSetting.findMany({ where: { userId } })
      : Promise.resolve([] as { key: string; value: string }[]),
  ]);

  const map: SettingsMap = {};
  for (const row of sysRows) {
    try {
      map[row.key] = JSON.parse(row.value);
    } catch {
      map[row.key] = row.value;
    }
  }
  for (const row of userRows) {
    try {
      map[row.key] = JSON.parse(row.value);
    } catch {
      map[row.key] = row.value;
    }
  }
  return map;
}

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.settings.findUnique({ where: { key } });
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const strValue = typeof value === "string" ? `"${value}"` : String(value);
  await prisma.settings.upsert({
    where: { key },
    update: { value: strValue },
    create: { key, value: strValue },
  });
}

async function getUserSetting(
  userId: string,
  key: string
): Promise<string | null> {
  const row = await prisma.userSetting.findUnique({
    where: { userId_key: { userId, key } },
  });
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

async function setUserSetting(
  userId: string,
  key: string,
  value: unknown
): Promise<void> {
  const strValue = typeof value === "string" ? `"${value}"` : String(value);
  await prisma.userSetting.upsert({
    where: { userId_key: { userId, key } },
    update: { value: strValue },
    create: { userId, key, value: strValue },
  });
}

export async function setSettingsForUser(
  userId: string,
  data: Record<string, unknown>
): Promise<void> {
  for (const [key, value] of Object.entries(data)) {
    if (USER_SCOPE_KEYS.has(key)) {
      await setUserSetting(userId, key, value);
    } else {
      await setSetting(key, value);
    }
  }
}
