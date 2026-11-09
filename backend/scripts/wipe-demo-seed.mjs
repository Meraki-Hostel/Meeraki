import "dotenv/config";
import { PrismaClient } from "@prisma/client";

// One-off cleanup: removes the local demo seed (owner@demo.com / manager@demo.com /
// student@demo.com and everything under their organization) from whatever database
// DATABASE_URL points at. Refuses to run unless that org contains EXACTLY those three
// users, so it can't accidentally delete a real customer's data.
const DEMO_EMAILS = ["owner@demo.com", "manager@demo.com", "student@demo.com"];

const prisma = new PrismaClient();

const demoUsers = await prisma.user.findMany({ where: { email: { in: DEMO_EMAILS } } });
if (demoUsers.length !== DEMO_EMAILS.length) {
  console.error(`Expected ${DEMO_EMAILS.length} demo users, found ${demoUsers.length}. Aborting, nothing deleted.`);
  process.exit(1);
}
const orgId = demoUsers[0].orgId;
if (!demoUsers.every((u) => u.orgId === orgId)) {
  console.error("Demo users span multiple organizations. Aborting, nothing deleted.");
  process.exit(1);
}
const totalUsersInOrg = await prisma.user.count({ where: { orgId } });
if (totalUsersInOrg !== DEMO_EMAILS.length) {
  console.error(`Organization ${orgId} has ${totalUsersInOrg} users, expected exactly the ${DEMO_EMAILS.length} demo accounts. Aborting, nothing deleted (there may be real data mixed in).`);
  process.exit(1);
}

const userIds = demoUsers.map((u) => u.id);

await prisma.$transaction([
  prisma.notification.deleteMany({ where: { recipientUserId: { in: userIds } } }),
  prisma.upload.deleteMany({ where: { orgId } }),
  prisma.user.deleteMany({ where: { orgId } }),
  prisma.invitation.deleteMany({ where: { orgId } }),
  prisma.staffMember.deleteMany({ where: { orgId } }),
  prisma.activityLog.deleteMany({ where: { orgId } }),
  prisma.bed.deleteMany({ where: { property: { orgId } } }),
  prisma.studentProfile.deleteMany({ where: { property: { orgId } } }),
  prisma.property.deleteMany({ where: { orgId } }),
  prisma.organization.delete({ where: { id: orgId } }),
]);

console.log(`Deleted demo organization ${orgId} (${DEMO_EMAILS.join(", ")}) and all its data.`);
await prisma.$disconnect();
