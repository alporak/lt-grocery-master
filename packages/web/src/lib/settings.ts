import { prisma } from "./db";

export type SettingsMap = Record<string, string>;

export async function getSettings(): Promise<SettingsMap> {
  const rows = await prisma.settings.findMany();
  const map: SettingsMap = {};
  for (const row of rows) {
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
