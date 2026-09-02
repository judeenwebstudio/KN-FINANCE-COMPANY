import "dotenv/config";
import { bootstrapRBAC } from "../src/lib/auth/bootstrap";
import { prisma } from "../src/lib/prisma";

async function main() {
  const result = await bootstrapRBAC();
  console.log("RBAC Bootstrap completed with results:", result);
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error("RBAC Bootstrap failed:", err);
    prisma.$disconnect();
    process.exit(1);
  });
