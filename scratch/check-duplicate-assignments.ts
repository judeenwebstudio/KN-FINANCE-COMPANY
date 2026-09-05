import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const users = await prisma.user.findMany({
    include: {
      roleAssignments: {
        include: { role: true },
      },
    },
  });

  console.log("=== USERS WITH MULTIPLE ROLE ASSIGNMENTS ===");
  let multiCount = 0;
  for (const u of users) {
    if (u.roleAssignments.length > 1) {
      multiCount++;
      console.log(`User: ${u.name} (${u.email}) [ID: ${u.id}]`);
      for (const ra of u.roleAssignments) {
        console.log(`  - ${ra.role.name} (slug: ${ra.role.slug}, isSuperAdminRole: ${ra.role.isSuperAdminRole})`);
      }
    }
  }
  if (multiCount === 0) {
    console.log("No users with multiple role assignments found.");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });
