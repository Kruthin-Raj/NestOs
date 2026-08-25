import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Sets a password on an existing account.
 *
 *   pnpm user:set-password you@example.com 'your-password'
 *
 * Normally unnecessary — anyone can set their own password through "Forgot
 * password", which emails a code. This exists for accounts whose address cannot
 * receive mail, for local development, and for admins: `pnpm admin:create` and
 * `pnpm db:seed` both create the account without a password, so one of them
 * plus this command is the only way to get an admin signed in.
 */
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const password = process.argv[3];

  if (!email || !password) {
    console.error("Usage: pnpm user:set-password <email> <password>");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No account found for ${email}`);
    process.exit(1);
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { email },
      data: {
        passwordHash: await bcrypt.hash(password, 10),
        isEmailVerified: true,
      },
    }),
    // Anyone holding an old session should not keep it after a password change.
    prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  // The password itself is never echoed.
  console.log(`✓ Password set for ${email} (${user.role})`);
  console.log("  Existing sessions revoked. Sign in at /login.");
}

main()
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
