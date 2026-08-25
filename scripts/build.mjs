import { readFile, readdir, mkdir, rm, cp, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(projectRoot, "dist");
const domain = "https://caminhandocomdeus365.com.br";

const palettes = {
  amarelo: {
    themeColor: "#a87621",
    shareText: "#9b6907",
    bible: "bible-2-trim.png"
  },
  azul: {
    themeColor: "#1464be",
    shareText: "#1464be",
    bible: "bible-1-trim.png"
  },
  rosa: {
    themeColor: "#c76696",
    shareText: "#c76696",
    bible: "bible-3-trim.png"
  },
  verde: {
    themeColor: "#2a6716",
    shareText: "#2a6716",
    bible: "bible-4-trim.png"
  }
};

async function listJsonFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listJsonFiles(absolute));
    if (entry.isFile() && entry.name.endsWith(".json")) files.push(absolute);
  }
  return files;
}

function relativeContentPath(file) {
  return path.relative(projectRoot, file).split(path.sep).join("/");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function stripHtml(value) {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&ldquo;", "“")
    .replaceAll("&rdquo;", "”")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .replace(/\s+/g, " ")
    .trim();
}

function youtubeId(url) {
  const parsed = new URL(url);
  if (parsed.hostname === "youtu.be") return parsed.pathname.split("/").filter(Boolean)[0];
  if (parsed.pathname.startsWith("/shorts/")) return parsed.pathname.split("/")[2];
  return parsed.searchParams.get("v");
}

function requireValue(object, key, source) {
  if (object[key] === undefined || object[key] === null || object[key] === "") {
    throw new Error(`Campo obrigatório ausente: ${key} em ${source}`);
  }
}

function requireIntegerInRange(value, min, max, field, source) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${field} inválido em ${source}: informe um número inteiro entre ${min} e ${max}.`);
  }
}

function requireMatchingFilename(file, expected) {
  const received = path.basename(file);
  if (received !== expected) {
    throw new Error(`Nome de arquivo incompatível: ${received}. O conteúdo exige ${expected}.`);
  }
}

async function loadContent() {
  const weekFiles = await listJsonFiles(path.join(projectRoot, "content", "semanas"));
  const devotionalFiles = await listJsonFiles(path.join(projectRoot, "content", "devocionais"));
  const weeks = new Map();

  for (const file of weekFiles) {
    const data = JSON.parse(await readFile(file, "utf8"));
    for (const field of ["numero", "tema", "proposito", "cor"]) requireValue(data, field, file);
    requireIntegerInRange(data.numero, 1, 53, "Número da semana", file);
    requireMatchingFilename(file, `semana-${data.numero}.json`);
    if (!palettes[data.cor]) throw new Error(`Cor inválida em ${file}: ${data.cor}`);
    weeks.set(relativeContentPath(file), data);
  }

  const devotionals = [];
  const devotionalIds = new Set();
  for (const file of devotionalFiles) {
    const data = JSON.parse(await readFile(file, "utf8"));
    for (const field of [
      "ano", "dia", "semana", "status", "oracao_inicial", "versiculo", "referencia",
      "contexto", "reflexao", "tarefa", "oracao_final", "louvor", "artista", "youtube"
    ]) requireValue(data, field, file);

    requireIntegerInRange(data.ano, 2026, 2100, "Ano", file);
    requireIntegerInRange(data.dia, 1, 366, "Dia do devocional", file);
    requireMatchingFilename(file, `dia-${data.dia}.json`);

    const devotionalId = `${data.ano}-${data.dia}`;
    if (devotionalIds.has(devotionalId)) {
      throw new Error(`Devocional duplicado: dia ${data.dia}/${data.ano}.`);
    }
    devotionalIds.add(devotionalId);

    if (!["rascunho", "publicado"].includes(data.status)) {
      throw new Error(`Status inválido em ${file}: ${data.status}`);
    }
    if (!weeks.has(data.semana)) {
      throw new Error(`Semana não encontrada para ${file}: ${data.semana}`);
    }
    if (!youtubeId(data.youtube)) {
      throw new Error(`Link do YouTube inválido em ${file}: ${data.youtube}`);
    }

    devotionals.push({ ...data, source: file, week: weeks.get(data.semana) });
  }

  return devotionals
    .filter(item => item.status === "publicado")
    .sort((a, b) => a.ano - b.ano || a.dia - b.dia);
}

function render(template, devotional) {
  const { week } = devotional;
  const palette = palettes[week.cor];
  const slug = `devocional-dia-${devotional.dia}-${devotional.ano}`;
  const canonical = `${domain}/${slug}/`;
  const shareImage = `${domain}/assets/compartilhamento/${devotional.ano}/dia-${devotional.dia}.png`;
  const videoId = youtubeId(devotional.youtube);
  const description = stripHtml(devotional.versiculo).slice(0, 220);

  const values = {
    COR: week.cor,
    THEME_COLOR: palette.themeColor,
    META_DESCRIPTION: escapeHtml(description),
    DIA: devotional.dia,
    OG_IMAGE: shareImage,
    CANONICAL: canonical,
    SEMANA: week.numero,
    TEMA: escapeHtml(week.tema),
    PROPOSITO: escapeHtml(week.proposito),
    ORACAO_INICIAL: devotional.oracao_inicial,
    VERSICULO: escapeHtml(devotional.versiculo),
    REFERENCIA: escapeHtml(devotional.referencia),
    CONTEXTO: devotional.contexto,
    REFLEXAO: devotional.reflexao,
    BIBLIA: palette.bible,
    TAREFA: devotional.tarefa,
    ORACAO_FINAL: devotional.oracao_final,
    LOUVOR: escapeHtml(devotional.louvor),
    ARTISTA: escapeHtml(devotional.artista),
    YOUTUBE: escapeHtml(devotional.youtube),
    YOUTUBE_ID: escapeHtml(videoId)
  };

  let output = template;
  for (const [key, value] of Object.entries(values)) {
    output = output.replaceAll(`{{${key}}}`, String(value));
  }
  const unresolved = output.match(/{{[A-Z_]+}}/g);
  if (unresolved) throw new Error(`Campos não resolvidos no modelo: ${unresolved.join(", ")}`);

  return { output, slug, canonical, shareImage, palette };
}

async function createShareImage(devotional, palette) {
  const base = path.join(
    projectRoot,
    "assets",
    "compartilhamento",
    "bases",
    `${devotional.week.cor}.png`
  );
  const destination = path.join(
    distDir,
    "assets",
    "compartilhamento",
    String(devotional.ano),
    `dia-${devotional.dia}.png`
  );
  await mkdir(path.dirname(destination), { recursive: true });

  const label = `DIA ${devotional.dia}`;
  const overlay = Buffer.from(`<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
    <rect x="405" y="695" width="271" height="61" fill="#fbf2d8"/>
    <text x="540.5" y="737" text-anchor="middle" font-family="Montserrat, Arial, sans-serif"
      font-size="32" font-weight="400" fill="${palette.shareText}">${label}</text>
  </svg>`);

  await sharp(base)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png({
      compressionLevel: 6,
      adaptiveFiltering: false,
      palette: true,
      quality: 90,
      colours: 256,
      dither: 1
    })
    .toFile(destination);
}

async function copyIfExists(source, destination) {
  try {
    await access(source);
    await cp(source, destination, { recursive: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function copyLegacyDevotionalPages() {
  const entries = await readdir(projectRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^devocional-dia-\d+-\d{4}$/.test(entry.name)) continue;
    await cp(path.join(projectRoot, entry.name), path.join(distDir, entry.name), { recursive: true });
  }
}

function rootPage(latest) {
  const slug = `devocional-dia-${latest.dia}-${latest.ano}`;
  const share = `${domain}/assets/compartilhamento/${latest.ano}/dia-${latest.dia}.png`;
  const target = `./${slug}/`;
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="refresh" content="0;url=${target}">
  <meta property="og:type" content="article">
  <meta property="og:locale" content="pt_BR">
  <meta property="og:title" content="Dia ${latest.dia} — Caminhando com Deus 365">
  <meta property="og:description" content="Seu devocional diário na palma da sua mão.">
  <meta property="og:image" content="${share}">
  <meta property="og:image:width" content="1080">
  <meta property="og:image:height" content="1080">
  <link rel="canonical" href="${domain}/${slug}/">
  <link rel="icon" href="./assets/favicons/favicon-${latest.week.cor}.png" type="image/png">
  <title>Dia ${latest.dia} — Caminhando com Deus 365</title>
</head>
<body>
  <p><a href="${target}">Abrir o devocional do dia ${latest.dia}</a></p>
</body>
</html>
`;
}

function notFoundPage(latest) {
  const slug = `devocional-dia-${latest.dia}-${latest.ano}/`;
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="icon" href="${domain}/assets/favicons/favicon-${latest.week.cor}.png" type="image/png">
  <title>Caminhando com Deus 365</title>
</head>
<body>
  <p>Redirecionando para o devocional atual…</p>
  <script>
    const base = location.hostname.endsWith("github.io") ? "/devocional/" : "/";
    location.replace(base + "${slug}");
  </script>
</body>
</html>
`;
}

async function build() {
  const template = await readFile(path.join(projectRoot, "templates", "devocional.html"), "utf8");
  const devotionals = await loadContent();
  if (!devotionals.length) throw new Error("Nenhum devocional publicado foi encontrado.");

  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
  await cp(path.join(projectRoot, "assets"), path.join(distDir, "assets"), { recursive: true });
  await cp(path.join(projectRoot, "styles.css"), path.join(distDir, "styles.css"));
  await cp(path.join(projectRoot, "favicon.png"), path.join(distDir, "favicon.png"));
  await copyIfExists(path.join(projectRoot, "CNAME"), path.join(distDir, "CNAME"));
  await copyLegacyDevotionalPages();
  await writeFile(path.join(distDir, ".nojekyll"), "");

  for (const devotional of devotionals) {
    const rendered = render(template, devotional);
    const pageDirectory = path.join(distDir, rendered.slug);
    await mkdir(pageDirectory, { recursive: true });
    await writeFile(path.join(pageDirectory, "index.html"), rendered.output);
    await createShareImage(devotional, rendered.palette);
  }

  const latest = devotionals.at(-1);
  await writeFile(path.join(distDir, "index.html"), rootPage(latest));
  await writeFile(path.join(distDir, "404.html"), notFoundPage(latest));

  console.log(`Site gerado com ${devotionals.length} devocional(is). Atual: dia ${latest.dia}/${latest.ano}.`);
}

await build();
