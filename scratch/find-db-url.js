const fs = require("fs");
const path = require("path");

const logsDir = path.join(__dirname, "../.system_generated/logs");
if (fs.existsSync(logsDir)) {
  const files = fs.readdirSync(logsDir);
  for (const f of files) {
    const fullPath = path.join(logsDir, f);
    if (fs.statSync(fullPath).isFile()) {
      const content = fs.readFileSync(fullPath, "utf8");
      const match = content.match(/postgres(?:ql)?:\/\/[^\s"'`\\]*ep-red-block-b35lno35[^\s"'`\\]*/i);
      if (match) {
        console.log("FOUND DB URL in log:", f);
        fs.writeFileSync(path.join(__dirname, "found_db_url.txt"), match[0]);
        process.exit(0);
      }
    }
  }
}

// Check root env files
const envFiles = [".env.production.local", ".env.local", ".env"];
for (const envFile of envFiles) {
  const p = path.join(__dirname, "..", envFile);
  if (fs.existsSync(p)) {
    const content = fs.readFileSync(p, "utf8");
    const match = content.match(/postgres(?:ql)?:\/\/[^\s"'`\\]*ep-red-block-b35lno35[^\s"'`\\]*/i);
    if (match) {
      console.log("FOUND DB URL in env file:", envFile);
      fs.writeFileSync(path.join(__dirname, "found_db_url.txt"), match[0]);
      process.exit(0);
    }
  }
}

console.log("Not found in logs or root env files.");
