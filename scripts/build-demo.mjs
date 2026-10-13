// Builds the preview and folds it into ONE html fragment (for publishing as a Claude artifact).
// Usage: node scripts/build-demo.mjs <output.html>
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const out = process.argv[2] ?? "dist-demo/rated-ai-preview.html";
execSync("npx vite build --config vite.demo.config.ts", { stdio: "inherit" });

const dir = "dist-demo";
const assets = fs.readdirSync(path.join(dir, "assets"));
const js = fs.readFileSync(path.join(dir, "assets", assets.find(f => f.endsWith(".js"))), "utf8");
const css = fs.readFileSync(path.join(dir, "assets", assets.find(f => f.endsWith(".css"))), "utf8");

// Public images are referenced by URL strings; inline them so the page is self-contained.
const art = {};
for (const f of fs.readdirSync("client/public/art")) art[`/art/${f}`] = `data:image/webp;base64,${fs.readFileSync(path.join("client/public/art", f)).toString("base64")}`;
const inline = text => text.replace(/\/art\/[a-z]+\.webp/g, m => art[m] ?? m);

const html = `<meta charset="utf-8">
<title>Rated AI Preview</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Lexend:wght@400;600&family=Nunito:wght@400;600;700;800&family=Baloo+Bhaijaan+2:wght@500;600;700&family=Cairo:wght@400;600;700;800&display=swap">
<style>${inline(css)}</style>
<div id="root"></div>
<script type="module">${inline(js).replace(/<\/script/gi, "<\\/script")}</script>
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`wrote ${out}: ${(html.length / 1024).toFixed(0)} KB`);
