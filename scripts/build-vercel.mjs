import fs from "fs";
import path from "path";

// Recursively copy a directory
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const root = process.cwd();
const distClient = path.join(root, "dist", "client");
const distServer = path.join(root, "dist", "server");
const out = path.join(root, ".vercel", "output");

// Clean and recreate .vercel/output
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

// 1. Static files → .vercel/output/static
console.log("→ Copying static assets...");
copyDir(distClient, path.join(out, "static"));

// 2. Server function → .vercel/output/functions/__server.func
const funcDir = path.join(out, "functions", "__server.func");
console.log("→ Copying server function...");
copyDir(distServer, funcDir);

// 3. Write Vercel Build Output API config.json
console.log("→ Writing .vercel/output/config.json...");
const config = {
  version: 3,
  routes: [
    // Cache immutable assets
    {
      src: "/assets/(.*)",
      headers: { "cache-control": "public, max-age=31536000, immutable" },
      continue: true,
    },
    // Serve static files directly if they exist
    { handle: "filesystem" },
    // Everything else → SSR function
    { src: "/(.*)", dest: "/__server.func" },
  ],
};
fs.writeFileSync(
  path.join(out, "config.json"),
  JSON.stringify(config, null, 2)
);

console.log("✅ .vercel/output ready for deployment!");
