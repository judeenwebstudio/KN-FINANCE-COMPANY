import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { getUserEffectivePermissions, getUserPrimaryRoleName } from "../src/lib/auth/authorize";

async function main() {
  console.log("=== LIVE PRODUCTION USER & RELATIONAL RBAC AUDIT ===");

  const targetEmail = "kabhinishainfotech@gmail.com";

  const user = await prisma.user.findUnique({
    where: { email: targetEmail },
    include: {
      roleAssignments: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!user) {
    console.error(`User with email '${targetEmail}' NOT FOUND in DB.`);
    // Search by name "Nivesh Raj" or any superadmin
    const usersByName = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: "Nivesh", mode: "insensitive" } },
          { email: { contains: "kabhinishainfotech", mode: "insensitive" } },
        ],
      },
      include: { roleAssignments: { include: { role: true } } },
    });
    console.log(`Found ${usersByName.length} user(s) matching 'Nivesh':`);
    for (const u of usersByName) {
      console.log(`User ID: ${u.id} | Name: "${u.name}" | Email: "${u.email}" | Status: ${u.status}`);
      for (const ra of u.roleAssignments) {
        console.log(`  - Role: "${ra.role.name}" (slug: "${ra.role.slug}", isSuperAdminRole: ${ra.role.isSuperAdminRole})`);
      }
    }
    return;
  }

  console.log(`User ID: ${user.id}`);
  console.log(`Name: "${user.name}"`);
  console.log(`Email: "${user.email}"`);
  console.log(`Status: ${user.status}`);
  console.log(`Legacy User.role: ${(user as any).role}`);
  console.log(`hasGlobalBranchAccess: ${user.hasGlobalBranchAccess}`);
  console.log(`\nActive UserRoleAssignments count: ${user.roleAssignments.length}`);

  let hasAdmin = false;
  let hasSuperAdmin = false;

  for (const ra of user.roleAssignments) {
    console.log(`  - Assignment ID: ${ra.id}`);
    console.log(`    Role ID: ${ra.roleId}`);
    console.log(`    Role Name: "${ra.role.name}"`);
    console.log(`    Role Slug: "${ra.role.slug}"`);
    console.log(`    Role Status: ${ra.role.status}`);
    console.log(`    isSuperAdminRole: ${ra.role.isSuperAdminRole}`);

    if (ra.role.slug === "admin") hasAdmin = true;
    if (ra.role.slug === "super_admin") hasSuperAdmin = true;
  }

  const primaryRoleName = await getUserPrimaryRoleName(user.id);
  const effectivePerms = await getUserEffectivePermissions(user.id);

  console.log(`\ngetUserPrimaryRoleName result: "${primaryRoleName}"`);
  console.log(`getUserEffectivePermissions count: ${effectivePerms.size}`);
  console.log(`Both Administrator & Super Administrator existed: ${hasAdmin && hasSuperAdmin}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });
