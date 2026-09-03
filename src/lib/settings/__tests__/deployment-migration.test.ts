import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("Vercel production builds deploy Prisma migrations before rendering settings", async () => {
  const packageJson = JSON.parse(
    await readFile(path.join(process.cwd(), "package.json"), "utf8"),
  ) as { scripts?: Record<string, string> };
  const vercelBuild = packageJson.scripts?.["vercel-build"] ?? "";

  assert.match(vercelBuild, /^prisma (?:migrate deploy|db execute)(?:\s|&&)/);
  assert.ok(
    Math.max(vercelBuild.indexOf("prisma migrate deploy"), vercelBuild.indexOf("prisma db execute")) <
      vercelBuild.indexOf("next build"),
    "Database migrations must run before the Next.js production build",
  );
});
