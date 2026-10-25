import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { isEmail, isIndianPhone, normalizePhone } from "../src/utils/validators.js";

// Creates the FIRST owner account and nothing else: no demo hostel, no students,
// no shared password. Refuses to run once any user exists.
//
//   ORG_NAME="…" OWNER_NAME="…" OWNER_EMAIL="…" OWNER_PHONE="9876543210" OWNER_PASSWORD="…" npm run db:seed:prod
const { ORG_NAME = "", OWNER_NAME = "", OWNER_EMAIL = "", OWNER_PHONE = "", OWNER_PASSWORD = "" } = process.env;

const problems = [];
if (ORG_NAME.trim().length < 2) problems.push("ORG_NAME (the business name) is required");
if (OWNER_NAME.trim().length < 2) problems.push("OWNER_NAME is required");
if (!isEmail(OWNER_EMAIL.trim())) problems.push("OWNER_EMAIL must be a valid email");
if (!isIndianPhone(OWNER_PHONE.trim())) problems.push("OWNER_PHONE must be a 10-digit Indian mobile number");
if (OWNER_PASSWORD.length < 12) problems.push("OWNER_PASSWORD must be at least 12 characters");
if (OWNER_PASSWORD === "meraki@123") problems.push("OWNER_PASSWORD must not be the demo password");
if (problems.length) {
  console.error(`Cannot create the first owner:\n - ${problems.join("\n - ")}`);
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  if ((await prisma.user.count()) > 0) {
    console.error("Refusing to run: users already exist in this database.");
    process.exitCode = 1;
  } else {
    const email = OWNER_EMAIL.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 12);
    await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({ data: { name: ORG_NAME.trim() } });
      await tx.user.create({
        data: {
          orgId: org.id, name: OWNER_NAME.trim(), email, phone: normalizePhone(OWNER_PHONE.trim()),
          role: "owner", title: "Owner", passwordHash,
        },
      });
    });
    console.log(`Created organization "${ORG_NAME.trim()}" and its owner ${email}. Sign in, then change the password from your profile.`);
  }
} finally {
  await prisma.$disconnect();
}
