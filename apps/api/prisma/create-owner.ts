import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole, OwnerVerificationStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Creates a pre-verified owner for local development.
 *
 *   pnpm owner:create owner@example.com [password] [full name]
 *
 * DEVELOPMENT ONLY. Two things make this unsafe against a real database:
 * it skips admin verification entirely, and run against an email that already
 * exists it OVERWRITES that owner's password and force-verifies them. Omitting
 * the password argument leaves a verified owner on a documented default.
 */
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const password = process.argv[3] || "NestOS123!";
  const fullName = process.argv[4] || "Property Owner";

  if (!email || !email.includes("@")) {
    console.error("Usage: npx tsx prisma/create-owner.ts <email> [password] [fullName]");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.role !== UserRole.OWNER) {
      console.error(`${email} already exists with role ${existing.role}. Cannot convert.`);
      process.exit(1);
    }
    // Update existing owner password & verify status
    await prisma.user.update({
      where: { email },
      data: {
        passwordHash: await bcrypt.hash(password, 10),
        isEmailVerified: true,
        isActive: true,
      },
    });
    await prisma.ownerProfile.updateMany({
      where: { userId: existing.id },
      data: { verificationStatus: OwnerVerificationStatus.VERIFIED },
    });
    console.log(`✓ Owner account updated: ${email}`);
  } else {
    // Create user + owner profile
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        role: UserRole.OWNER,
        passwordHash,
        isEmailVerified: true,
        isActive: true,
        ownerProfile: {
          create: {
            fullName,
            businessName: `${fullName}'s Properties`,
            verificationStatus: OwnerVerificationStatus.VERIFIED,
            upiId: "owner@upi",
            verifiedAt: new Date(),
          },
        },
      },
    });
    console.log(`✓ Verified Owner created: ${user.email}`);
  }

  console.log(`  Email: ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  Status: VERIFIED (Can manage buildings immediately)`);
}

main()
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
