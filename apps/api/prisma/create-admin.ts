import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole, UserStatus } from "@prisma/client";

/**
 * Creates (or promotes) a SUPER_ADMIN.
 *
 * Self-signup is restricted to OWNER and TENANT in auth.validation.ts, so admin
 * accounts cannot be created through the UI by design. Run:
 *
 *   pnpm admin:create you@example.com
 *
 * Login is still OTP-by-email, so the address must be one you can receive mail
 * at — or read the code from the API console in development.
 */
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();

  if (!email || !email.includes("@")) {
    console.error("Usage: pnpm admin:create <email>");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing && existing.role !== UserRole.SUPER_ADMIN) {
    // Promoting an owner or tenant would leave their profile row orphaned from
    // their new role, so make the caller deal with it deliberately.
    console.error(
      `${email} already exists as ${existing.role}. Refusing to change the role of an existing account.`
    );
    process.exit(1);
  }

  const user = await prisma.user.upsert({
    where:  { email },
    // Re-activating on re-run is deliberate: this is how you recover an admin
    // that was suspended or blocked and locked everyone out of /admin.
    update: { status: UserStatus.ACTIVE, statusReason: null },
    create: {
      email,
      role:            UserRole.SUPER_ADMIN,
      isEmailVerified: true,
      status:          UserStatus.ACTIVE,
    },
  });

  console.log(existing ? `✓ Already an admin: ${user.email}` : `✓ Admin created: ${user.email}`);
  console.log("  Sign in at /login with this address, then open /admin");
}

main()
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
