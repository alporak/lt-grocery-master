import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Seed stores — Barbora is Maxima's online platform
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
      name: "Barbora (Maxima)",
      chain: "MAXIMA",
      url: "https://barbora.lt/",
    },
    {
      slug: "rimi",
      name: "Rimi",
      chain: "RIMI",
      url: "https://www.rimi.lt/e-parduotuve",
    },
    {
      slug: "lidl",
      name: "Lidl",
      chain: "LIDL",
      url: "https://www.lidl.lt/",
    },
  ];

  for (const store of stores) {
    await prisma.store.upsert({
      where: { slug: store.slug },
      update: { name: store.name, chain: store.chain },
      create: store,
    });
  }

  // Seed some real store locations for nearest-shop feature
  const locations = [
    // IKI locations (Vilnius)
    { storeSlug: "iki", address: "Ozo g. 25", city: "Vilnius", lat: 54.7103, lng: 25.2639, size: "HYPERMARKET", hours: "8:00-22:00" },
    { storeSlug: "iki", address: "Ukmerges g. 369", city: "Vilnius", lat: 54.7276, lng: 25.2780, size: "LARGE", hours: "8:00-22:00" },
    { storeSlug: "iki", address: "Justiniskiu g. 64", city: "Vilnius", lat: 54.7166, lng: 25.2310, size: "MEDIUM", hours: "8:00-22:00" },
    { storeSlug: "iki", address: "Gedimino pr. 28", city: "Vilnius", lat: 54.6892, lng: 25.2694, size: "MEDIUM", hours: "8:00-22:00" },
    { storeSlug: "iki", address: "Laisves pr. 60", city: "Kaunas", lat: 54.8985, lng: 23.9182, size: "LARGE", hours: "8:00-22:00" },
    // Maxima / Barbora locations
    { storeSlug: "barbora", address: "Mindaugo g. 11", city: "Vilnius", lat: 54.6793, lng: 25.2670, size: "HYPERMARKET", hours: "8:00-23:00" },
    { storeSlug: "barbora", address: "Savanoriu pr. 62", city: "Vilnius", lat: 54.6731, lng: 25.2587, size: "HYPERMARKET", hours: "8:00-23:00" },
    { storeSlug: "barbora", address: "Ukmerges g. 244", city: "Vilnius", lat: 54.7243, lng: 25.2637, size: "LARGE", hours: "8:00-22:00" },
    { storeSlug: "barbora", address: "Zirmunu g. 68", city: "Vilnius", lat: 54.7102, lng: 25.2918, size: "LARGE", hours: "8:00-22:00" },
    { storeSlug: "barbora", address: "Karaliaus Mindaugo pr. 49", city: "Kaunas", lat: 54.8973, lng: 23.9366, size: "HYPERMARKET", hours: "8:00-23:00" },
    // Rimi locations
    { storeSlug: "rimi", address: "Ozo g. 18", city: "Vilnius", lat: 54.7098, lng: 25.2663, size: "HYPERMARKET", hours: "8:00-22:00" },
    { storeSlug: "rimi", address: "Pilies g. 16", city: "Vilnius", lat: 54.6834, lng: 25.2877, size: "MEDIUM", hours: "8:00-22:00" },
    { storeSlug: "rimi", address: "Ukmerges g. 329A", city: "Vilnius", lat: 54.7315, lng: 25.2717, size: "LARGE", hours: "8:00-22:00" },
    { storeSlug: "rimi", address: "Islandijos pl. 32", city: "Kaunas", lat: 54.9137, lng: 23.9639, size: "HYPERMARKET", hours: "8:00-22:00" },
    // PROMO Cash&Carry
    { storeSlug: "promo-cash-and-carry", address: "Ukmerges g. 120", city: "Vilnius", lat: 54.7167, lng: 25.2644, size: "HYPERMARKET", hours: "7:00-21:00" },
    { storeSlug: "promo-cash-and-carry", address: "Savanoriu pr. 255", city: "Kaunas", lat: 54.8792, lng: 23.9455, size: "HYPERMARKET", hours: "7:00-21:00" },
  ];

  // Get store IDs
  const storeMap = new Map<string, number>();
  const allStores = await prisma.store.findMany();
  for (const s of allStores) storeMap.set(s.slug, s.id);

  // Only seed if no locations exist yet
  const existingLocCount = await prisma.storeLocation.count();
  if (existingLocCount === 0) {
    for (const loc of locations) {
      const sid = storeMap.get(loc.storeSlug);
      if (!sid) continue;
      await prisma.storeLocation.create({
        data: {
          storeId: sid,
          address: loc.address,
          city: loc.city,
          lat: loc.lat,
          lng: loc.lng,
          sizeCategory: loc.size,
          openingHours: loc.hours,
        },
      });
    }
    console.log(`Seeded ${locations.length} store locations.`);
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
