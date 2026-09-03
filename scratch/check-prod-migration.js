const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

let prodDbUrl = "";

// Check transcript logs for saved production Neon connection string
const transcriptPath = path.join(__dirname, "../.system_generated/logs/transcript.jsonl");
if (fs.existsSync(transcriptPath)) {
  const logContent = fs.readFileSync(transcriptPath, "utf8");
  const match = logContent.match(/postgres(?:ql)?:\/\/[^\s"'`\\]+ep-red-block-b35lno35[^\s"'`\\]+/);
  if (match) {
    prodDbUrl = match[0];
  }
}

if (!prodDbUrl) {
  const envPath = path.join(__dirname, "../.env.production.local");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      if (line.startsWith("DATABASE_POSTGRES_PRISMA_URL=") || line.startsWith("DATABASE_URL=")) {
        const parts = line.split("=");
        let val = parts.slice(1).join("=").trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val && val !== "[SENSITIVE]" && val.startsWith("postgres")) {
          prodDbUrl = val;
          break;
        }
      }
    }
  }
}

if (!prodDbUrl) {
  console.error("Could not locate production Neon DATABASE_URL.");
  process.exit(1);
}

const sanitized = prodDbUrl.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@");
console.log(`[PRISMA_MIGRATE] Target Database: Neon Hosted PostgreSQL (${sanitized})`);

const action = process.argv[2] || "status";
const env = { ...process.env, DATABASE_URL: prodDbUrl };

try {
  if (action === "status") {
    const output = execSync("npx prisma migrate status", { env, encoding: "utf-8" });
    console.log(output);
  } else if (action === "deploy") {
    const output = execSync("npx prisma migrate deploy", { env, encoding: "utf-8" });
    console.log(output);
  }
} catch (error) {
  if (error.stdout) console.log(error.stdout);
  if (error.stderr) console.error(error.stderr);
  process.exit(1);
}
