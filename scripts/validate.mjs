import { readFile, access, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(projectRoot, "dist");
const contentDir = path.join(projectRoot, "content", "devocionais", "2026");

const published = [];
for (const name of await readdir(contentDir)) {
  if (!name.endsWith(".json")) continue;
  const data = JSON.parse(await readFile(path.join(contentDir, name), "utf8"));
  if (data.status === "publicado") published.push(data);
}
published.sort((a, b) => a.dia - b.dia);
if (!published.length) throw new Error("Nenhum devocional publicado para validar.");

const latest = published.at(-1);
const slug = `devocional-dia-${latest.dia}-${latest.ano}`;
const root = await readFile(path.join(distDir, "index.html"), "utf8");
const page = await readFile(path.join(distDir, slug, "index.html"), "utf8");
const share = path.join(distDir, "assets", "compartilhamento", String(latest.ano), `dia-${latest.dia}.png`);

const checks = [
  [root.includes(`./${slug}/`), "A página inicial não aponta para o devocional atual."],
  [page.includes(`Dia ${latest.dia}`), "O número do dia não aparece na página."],
  [page.includes(latest.referencia), "A referência bíblica não aparece na página."],
  [page.includes(latest.youtube.replaceAll("&", "&amp;")), "O link do YouTube não aparece na página."],
  [!page.includes("{{"), "Existem campos do modelo sem preenchimento."]
];

for (const [passed, message] of checks) {
  if (!passed) throw new Error(message);
}
await access(share);
const image = await sharp(share).metadata();
if (image.width !== 1080 || image.height !== 1080) {
  throw new Error(`A imagem de compartilhamento deve ter 1080 × 1080 px; encontrada: ${image.width} × ${image.height}.`);
}
await sharp(share).raw().toBuffer();

const legacyPage = path.join(distDir, "devocional-dia-229-2026", "index.html");
await access(legacyPage);

const pageDirectory = path.join(distDir, slug);
const references = [...page.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]);
for (const reference of references) {
  if (/^(?:https?:|mailto:|tel:|#)/.test(reference)) continue;
  await access(path.resolve(pageDirectory, reference));
}

console.log(`Validação concluída: dia ${latest.dia}/${latest.ano}, página e imagem de compartilhamento prontas.`);
