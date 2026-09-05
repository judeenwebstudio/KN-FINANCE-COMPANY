import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { getUserEffectivePermissions, getUserPrimaryRoleName } from "../src/lib/auth/authorize";

async function main() {
  const users = await prisma.user.findMany({
    include: {
      roleAssignments: {
        include: {
          role: true,
        },
      },
    },
  });

  console.log(`=== ALL USERS IN DB (Total: ${users.length}) ===`);
  for (const u of users) {
    console.log(`User ID: ${u.id}`);
    console.log(`Name: "${u.name}"`);
    console.log(`Email: "${u.email}"`);
    console.log(`Status: ${u.status}`);
    console.log(`Legacy user.role: ${(u as any).role}`);
    console.log(`hasGlobalBranchAccess: ${u.hasGlobalBranchAccess}`);
    console.log(`Role Assignments Count: ${u.roleAssignments.length}`);
    for (const ra of u.roleAssignments) {
      console.log(`  - Assignment ID: ${ra.id}, Role ID: ${ra.roleId}, Role Name: "${ra.role.name}", Role Slug: "${ra.role.slug}", isSuperAdminRole: ${ra.role.isSuperAdminRole}`);
    }

    const primaryRoleName = await getUserPrimaryRoleName(u.id);
    const effectivePerms = await getUserEffectivePermissions(u.id);
    console.log(`getUserPrimaryRoleName: "${primaryRoleName}"`);
    console.log(`Effective Permissions Count: ${effectivePerms.size}`);
    console.log("-----------------------------------------");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });
