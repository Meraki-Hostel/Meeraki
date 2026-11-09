import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { isEmail, isIndianPhone, normalizePhone } from "../src/utils/validators.js";

// Creates ONE new organization + its owner, without touching any existing data.
// Unlike prisma/seed-prod.js, this does NOT refuse just because other users already
// exist in the database — it only refuses if the given OWNER_EMAIL is already taken.
//
//   ORG_NAME="…" OWNER_NAME="…" OWNER_EMAIL="…" OWNER_PHONE="9876543210" OWNER_PASSWORD="…" node scripts/create-customer.mjs
const { ORG_NAME = "", OWNER_NAME = "", OWNER_EMAIL = "", OWNER_PHONE = "", OWNER_PASSWORD = "" } = process.env;

const problems = [];
if (ORG_NAME.trim().length < 2) problems.push("ORG_NAME (the business name) is required");
if (OWNER_NAME.trim().length < 2) problems.push("OWNER_NAME is required");
if (!isEmail(OWNER_EMAIL.trim())) problems.push("OWNER_EMAIL must be a valid email");
if (!isIndianPhone(OWNER_PHONE.trim())) problems.push("OWNER_PHONE must be a 10-digit Indian mobile number");
if (OWNER_PASSWORD.length < 12) problems.push("OWNER_PASSWORD must be at least 12 characters");
if (OWNER_PASSWORD === "meraki@123") problems.push("OWNER_PASSWORD must not be the demo password");
if (problems.length) {
  console.error(`Cannot create the customer:\n - ${problems.join("\n - ")}`);
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const email = OWNER_EMAIL.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.error(`Refusing to run: a user with email ${email} already exists.`);
    process.exitCode = 1;
  } else {
    const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 12);
    const org = await prisma.$transaction(async (tx) => {
      const o = await tx.organization.create({ data: { name: ORG_NAME.trim() } });
      await tx.user.create({
        data: {
          orgId: o.id, name: OWNER_NAME.trim(), email, phone: normalizePhone(OWNER_PHONE.trim()),
          role: "owner", title: "Owner", passwordHash,
        },
      });
      return o;
    });
    console.log(`Created organization "${ORG_NAME.trim()}" (${org.id}) and its owner ${email}.`);
  }
} finally {
  await prisma.$disconnect();
}
