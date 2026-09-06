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
  // Come fallback, passiamo attraverso alcuni proxy pubblici che rifanno la
  // richiesta da un altro indirizzo IP. Sono servizi gratuiti e a volte non
  // disponibili: li proviamo in ordine e ripetiamo il giro qualche volta.
  const endpoints = [
    { label: "diretto", url: feedUrl },
    { label: "allorigins", url: `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}` },
    { label: "codetabs", url: `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(feedUrl)}` },
    { label: "corsproxy.io", url: `https://corsproxy.io/?url=${encodeURIComponent(feedUrl)}` },
    { label: "r.jina.ai", url: `https://r.jina.ai/${feedUrl}` }
  ];

  const REQUEST_TIMEOUT_MS = 20000;
  const ROUNDS = 3;
  const PAUSE_BETWEEN_ROUNDS_MS = 15000;

  async function tryFetch(endpoint) {
    const res = await fetch(endpoint.url, {
      headers: browserHeaders,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const text = await res.text();
    if (!text.includes("<item") && !text.includes("<rss")) {
      throw new Error(`risposta senza contenuto RSS riconoscibile (${text.slice(0, 120).replace(/\s+/g, " ")})`);
    }
    return text;
  }

  let xml = null;
  const errors = [];
  for (let round = 1; round <= ROUNDS && !xml; round++) {
    for (const endpoint of endpoints) {
      try {
        xml = await tryFetch(endpoint);
        console.log(`Feed scaricato con successo (${endpoint.label}, giro ${round})`);
        break;
      } catch (err) {
        errors.push(`giro ${round} · ${endpoint.label}: ${err.message}`);
      }
    }
    if (!xml && round < ROUNDS) {
      await new Promise(r => setTimeout(r, PAUSE_BETWEEN_ROUNDS_MS));
    }
  }

  if (!xml) {
    // Feed momentaneamente irraggiungibile (Substack + proxy tutti giù): non è
    // un problema del sito, quindi non facciamo fallire il workflow. Lasciamo
    // articles.json com'è; al run successivo si riprova.
    console.log(`::warning::Feed Substack non raggiungibile in questo run, articoli non aggiornati. Tentativi:\n${errors.map(e => `  - ${e}`).join("\n")}`);
    return;
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
