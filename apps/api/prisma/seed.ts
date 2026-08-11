import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole } from "@prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  const admin = await prisma.user.upsert({
    where: { email: "admin@nestos.in" },
    update: {},
    create: {
      email: "admin@nestos.in",
      role: UserRole.SUPER_ADMIN,
      isEmailVerified: true,
      isActive: true,
    },
  });

  console.log(`✓ Super Admin created: ${admin.email}`);
  console.log("\nDatabase seeded successfully.");
  console.log("\nTest accounts:");
  console.log("  Super Admin: admin@nestos.in");
  console.log("  (Use OTP login — OTP logged to console in development)");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });