import { prisma } from "../src/lib/prisma";

async function checkMigrations() {
  console.log("=== CHECKING _prisma_migrations TABLE ===");
  try {
    const rawMigrations = await prisma.$queryRaw<Array<{
      id: string;
      checksum: string;
      finished_at: Date;
      migration_name: string;
      logs: string | null;
      rolled_back_at: Date | null;
      started_at: Date;
      applied_steps_count: number;
    }>>`SELECT * FROM "_prisma_migrations" ORDER BY started_at ASC;`;

    console.log(`Total applied migrations in _prisma_migrations: ${rawMigrations.length}`);
    for (const m of rawMigrations) {
      console.log(`- ${m.migration_name} | finished_at: ${m.finished_at} | steps: ${m.applied_steps_count}`);
    }
  } catch (err: any) {
    console.error("Failed to query _prisma_migrations:", err.message);
  }
}

checkMigrations().finally(() => prisma.$disconnect());
