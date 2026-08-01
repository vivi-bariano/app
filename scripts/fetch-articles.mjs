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
      excerpt: description ? makeExcerpt(description) : ""
    };
  }).filter(a => a.title && a.link);
}

async function main() {
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  const feedUrl = config.substackFeedUrl;
  if (!feedUrl) {
    throw new Error("substackFeedUrl mancante in site/data/config.json");
  }

  const res = await fetch(feedUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "application/rss+xml, application/xml, text/xml, */*"
    }
  });
  if (!res.ok) {
    throw new Error(`Fetch feed fallito: ${res.status} ${res.statusText}`);
  }
  const xml = await res.text();

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
