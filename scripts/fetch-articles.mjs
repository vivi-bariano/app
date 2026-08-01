#!/usr/bin/env node
// Fetches the Substack RSS feed configured in site/data/config.json and
// writes a plain JSON array of articles to site/data/articles.json.
// Zero external dependencies on purpose, so it runs reliably in CI
// without an npm install step.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_DIR = path.join(__dirname, "..", "site");
const CONFIG_PATH = path.join(SITE_DIR, "data", "config.json");
const OUTPUT_PATH = path.join(SITE_DIR, "data", "articles.json");
const MAX_ARTICLES = 30;
const EXCERPT_LENGTH = 220;

function extractTag(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = block.match(re);
  if (!match) return "";
  return unwrapCdata(match[1]).trim();
}

function unwrapCdata(str) {
  const m = str.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return m ? m[1] : str;
}

const NAMED_ENTITIES = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  hellip: "…", mdash: "—", ndash: "–",
  egrave: "è", eacute: "é", agrave: "à", ograve: "ò",
  ugrave: "ù", igrave: "ì", ecirc: "ê", ccedil: "ç",
  ntilde: "ñ"
};

function decodeEntities(str) {
  return str
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

function stripHtml(html) {
  return decodeEntities(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeExcerpt(html) {
  const text = stripHtml(html);
  if (text.length <= EXCERPT_LENGTH) return text;
  return text.slice(0, EXCERPT_LENGTH).replace(/\s+\S*$/, "") + "…";
}

function extractImage(block, descriptionHtml) {
  const enclosureMatch = block.match(/<enclosure[^>]*\burl="([^"]+)"[^>]*>/i);
  if (enclosureMatch) return enclosureMatch[1];

  const mediaMatch = block.match(/<media:content[^>]*\burl="([^"]+)"[^>]*>/i);
  if (mediaMatch) return mediaMatch[1];

  const imgMatch = descriptionHtml.match(/<img[^>]*\bsrc="([^"]+)"[^>]*>/i);
  if (imgMatch) return imgMatch[1];

  return "";
}

function parseRss(xml) {
  const items = xml.match(/<item[^>]*>[\s\S]*?<\/item>/g) || [];
  return items.map(block => {
    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const pubDateRaw = extractTag(block, "pubDate");
    const description = extractTag(block, "description");
    const pubDate = pubDateRaw ? new Date(pubDateRaw).toISOString() : null;
    return {
      title,
      link,
      pubDate,
      excerpt: description ? makeExcerpt(description) : "",
      image: extractImage(block, description)
    };
  }).filter(a => a.title && a.link);
}

async function main() {
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  const feedUrl = config.substackFeedUrl;
  if (!feedUrl) {
    throw new Error("substackFeedUrl mancante in site/data/config.json");
  }

  const browserHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/rss+xml, application/xml, text/xml, */*"
  };

  // Substack blocca le richieste dirette dai server di GitHub Actions (403),
  // indipendentemente dallo User-Agent: probabilmente un blocco per intervallo IP.
  // Come fallback, passiamo attraverso un proxy pubblico che effettua la
  // richiesta con un altro indirizzo IP.
  const attempts = [
    { label: "diretto", url: feedUrl },
    { label: "proxy allorigins", url: `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}` },
    { label: "proxy r.jina.ai", url: `https://r.jina.ai/${feedUrl}` }
  ];

  let xml = null;
  const errors = [];
  for (const attempt of attempts) {
    try {
      const res = await fetch(attempt.url, { headers: browserHeaders });
      if (!res.ok) {
        errors.push(`${attempt.label}: ${res.status} ${res.statusText}`);
        continue;
      }
      const text = await res.text();
      if (!text.includes("<item") && !text.includes("<rss")) {
        errors.push(`${attempt.label}: risposta senza contenuto RSS riconoscibile (${text.slice(0, 120).replace(/\s+/g, " ")})`);
        continue;
      }
      xml = text;
      console.log(`Feed scaricato con successo (${attempt.label})`);
      break;
    } catch (err) {
      errors.push(`${attempt.label}: ${err.message}`);
    }
  }

  if (!xml) {
    throw new Error(`Fetch feed fallito su tutti i tentativi:\n${errors.map(e => `  - ${e}`).join("\n")}`);
  }

  let articles = parseRss(xml);
  articles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  articles = articles.slice(0, MAX_ARTICLES);

  await writeFile(OUTPUT_PATH, JSON.stringify(articles, null, 2) + "\n", "utf8");
  console.log(`Scritti ${articles.length} articoli in ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
