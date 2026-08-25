import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const [productionDist, previewDist] = process.argv.slice(2).map(value => path.resolve(value));
if (!productionDist || !previewDist) {
  throw new Error("Informe as pastas dist do site oficial e da prévia.");
}

const previewTarget = path.join(productionDist, "preview");
await rm(previewTarget, { recursive: true, force: true });
await mkdir(previewTarget, { recursive: true });
await cp(previewDist, previewTarget, { recursive: true });
await rm(path.join(previewTarget, "CNAME"), { force: true });

async function addNoIndex(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await addNoIndex(file);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".html")) continue;

    const html = await readFile(file, "utf8");
    const protectedHtml = html.includes('name="robots"')
      ? html
      : html.replace("<head>", '<head>\n  <meta name="robots" content="noindex,nofollow,noarchive">');
    await writeFile(file, protectedHtml);
  }
}

await addNoIndex(previewTarget);

const robotsPath = path.join(productionDist, "robots.txt");
let robots = "";
try {
  robots = await readFile(robotsPath, "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (!robots.includes("Disallow: /preview/")) {
  const separator = robots && !robots.endsWith("\n") ? "\n" : "";
  robots += `${separator}User-agent: *\nDisallow: /preview/\n`;
  await writeFile(robotsPath, robots);
}

console.log("Prévia online adicionada em /preview/ com proteção noindex.");
