import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Seed stores
  const stores = [
    {
      slug: "iki",
      name: "IKI",
      chain: "IKI",
      url: "https://www.lastmile.lt/chain/IKI",
    },
    {
      slug: "promo-cash-and-carry",
      name: "PROMO Cash&Carry",
      chain: "PROMO",
      url: "https://www.lastmile.lt/chain/PROMO-CashandCarry",
    },
    {
      slug: "barbora",
      name: "Barbora",
      chain: "BARBORA",
      url: "https://barbora.lt/",
    },
    {
      slug: "rimi",
      name: "Rimi",
      chain: "RIMI",
      url: "https://www.rimi.lt/e-parduotuve",
    },
  ];

  for (const store of stores) {
    await prisma.store.upsert({
      where: { slug: store.slug },
      update: store,
      create: store,
    });
  }

  // Seed default settings
  const defaults: Record<string, string> = {
    language: '"lt"',
    theme: '"light"',
    address: '""',
    lat: "0",
    lng: "0",
    scrapeIntervalHours: "24",
    priceRetentionDays: "90",
  };

  for (const [key, value] of Object.entries(defaults)) {
    await prisma.settings.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
