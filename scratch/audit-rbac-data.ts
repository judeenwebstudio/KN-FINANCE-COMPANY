import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("=== COMPREHENSIVE RBAC DATA AUDIT ===");

  const roles = await prisma.roleProfile.findMany({
    include: {
      _count: {
        select: { userAssignments: true },
      },
    },
  });

  console.log(`\n--- ALL ROLE PROFILES (${roles.length}) ---`);
  for (const r of roles) {
    console.log(
      `ID: ${r.id} | Name: "${r.name}" | Slug: "${r.slug}" | isSuperAdminRole: ${r.isSuperAdminRole} | Status: ${r.status} | Assignments: ${r._count.userAssignments}`
    );
  }

  const users = await prisma.user.findMany({
    include: {
      roleAssignments: {
        include: {
          role: true,
        },
      },
    },
  });

  console.log(`\n--- USERS WITH ROLE ASSIGNMENTS (${users.length} total users) ---`);
  for (const u of users) {
    if (u.roleAssignments.length > 0 || (u as any).role === "SUPER_ADMIN" || (u as any).role === "ADMIN" || u.email.includes("admin") || u.name.includes("Nivesh") || u.name.includes("Avery")) {
      console.log(`\nUser ID: ${u.id}`);
      console.log(`Name: "${u.name}"`);
      console.log(`Email: "${u.email}"`);
      console.log(`Status: ${u.status}`);
      console.log(`Legacy User.role: ${(u as any).role}`);
      console.log(`hasGlobalBranchAccess: ${u.hasGlobalBranchAccess}`);
      console.log(`Role Assignments (${u.roleAssignments.length}):`);
      for (const ra of u.roleAssignments) {
        console.log(
          `  - RA ID: ${ra.id} | Role ID: ${ra.roleId} | Role Name: "${ra.role.name}" | Role Slug: "${ra.role.slug}" | Role Status: ${ra.role.status} | isSuperAdminRole: ${ra.role.isSuperAdminRole}`
        );
      }
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });
