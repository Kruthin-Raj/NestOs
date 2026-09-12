import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

/**
 * One-time backfill script to geocode buildings that have missing coordinates
 * (latitude IS NULL OR longitude IS NULL).
 *
 * Uses OpenStreetMap's Nominatim API with a compliant rate limit of >= 1100ms
 * between requests and a custom User-Agent header.
 *
 * Usage:
 *   pnpm backfill:coordinates
 */
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

interface NominatimResult {
  lat: string;
  lon: string;
  display_name?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log("Searching for buildings missing coordinates...");

  const buildings = await prisma.building.findMany({
    where: {
      OR: [{ latitude: null }, { longitude: null }],
    },
    select: {
      id: true,
      addressLine1: true,
      city: true,
      state: true,
      pincode: true,
    },
  });

  if (buildings.length === 0) {
    console.log("✓ No buildings require coordinate backfilling. All buildings have coordinates.");
    return;
  }

  console.log(`Found ${buildings.length} building(s) requiring coordinate backfilling.\n`);

  let updatedCount = 0;
  let missedCount = 0;

  for (let i = 0; i < buildings.length; i++) {
    const building = buildings[i];
    const addressQuery = `${building.addressLine1}, ${building.city}, ${building.state}, ${building.pincode}`;
    const progress = `[${i + 1}/${buildings.length}]`;

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
        addressQuery
      )}`;

      const res = await fetch(url, {
        headers: {
          "User-Agent": "NestOS/1.0 (backfill script)",
        },
      });

      if (!res.ok) {
        throw new Error(`Nominatim API returned HTTP ${res.status}`);
      }

      const results = (await res.json()) as NominatimResult[];

      if (results && results.length > 0 && results[0].lat && results[0].lon) {
        const lat = parseFloat(results[0].lat);
        const lon = parseFloat(results[0].lon);

        if (isNaN(lat) || isNaN(lon)) {
          console.log(`✗ ${progress} ${building.id} — "${addressQuery}" -> Invalid coordinates received from Nominatim`);
          missedCount++;
        } else {
          await prisma.building.update({
            where: { id: building.id },
            data: {
              latitude: lat,
              longitude: lon,
            },
          });

          console.log(`✓ ${progress} ${building.id} — "${addressQuery}" -> (${lat}, ${lon})`);
          updatedCount++;
        }
      } else {
        console.log(`✗ ${progress} ${building.id} — "${addressQuery}" -> No coordinates found (miss)`);
        missedCount++;
      }
    } catch (err) {
      console.error(
        `✗ ${progress} ${building.id} — "${addressQuery}" -> Error:`,
        err instanceof Error ? err.message : err
      );
      missedCount++;
    }

    // Respect Nominatim's usage policy: wait at least 1100ms between requests
    if (i < buildings.length - 1) {
      await sleep(1100);
    }
  }

  console.log("\n================ Backfill Summary ================");
  console.log(`Total processed: ${buildings.length}`);
  console.log(`✓ Successfully updated: ${updatedCount}`);
  console.log(`✗ Missed (fix via pnpm db:studio): ${missedCount}`);
  console.log("==================================================");
}

main()
  .catch((err) => {
    console.error("Fatal error during coordinate backfill:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
