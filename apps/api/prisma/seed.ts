import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole, UserStatus } from "@prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

/**
 * The project's admin address. Because this is an upsert on email, seeding the
 * shared database leaves the existing admin alone instead of adding a second
 * one — which is what happened while this pointed at a placeholder address
 * nobody could receive mail at.
 *
 * Override with SEED_ADMIN_EMAIL when seeding your own local database.
 */
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "nestossupport@gmail.com";

async function main() {
  console.log("Seeding database...");

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      role: UserRole.SUPER_ADMIN,
      isEmailVerified: true,
      status: UserStatus.ACTIVE,
    },
  });

  console.log(`✓ Super Admin ready: ${admin.email}`);
  console.log("\nDatabase seeded successfully.");
  console.log("\nTest accounts:");
  console.log(`  Super Admin: ${admin.email}`);
  // No password is created here, and sign-in is by password — an OTP is only
  // used to confirm an address at signup or to authorise a reset.
  console.log(`  Set a password with: pnpm user:set-password ${admin.email} '<password>'`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });