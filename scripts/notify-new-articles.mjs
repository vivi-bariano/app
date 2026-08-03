#!/usr/bin/env node
// Compares articles.json before/after an update and sends a push
// notification (via OneSignal) for each article that wasn't there before.
// Usage: node notify-new-articles.mjs <before.json> <after.json>

import { readFile } from "node:fs/promises";
import { sendNotification } from "./onesignal.mjs";

const MAX_NOTIFICATIONS = 5;
const SITE_URL = "https://vivi-bariano.github.io/app/";

async function readJsonSafe(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return [];
  }
}

async function main() {
  const [, , beforePath, afterPath] = process.argv;
  if (!beforePath || !afterPath) {
    throw new Error("Uso: node notify-new-articles.mjs <before.json> <after.json>");
  }

  if (!process.env.ONESIGNAL_REST_API_KEY) {
    console.log("ONESIGNAL_REST_API_KEY non impostata: notifiche push saltate.");
    return;
  }

  const before = await readJsonSafe(beforePath);
  const after = await readJsonSafe(afterPath);
  const knownLinks = new Set(before.map(a => a.link));

  const newArticles = after
    .filter(a => !knownLinks.has(a.link))
    .sort((a, b) => new Date(a.pubDate) - new Date(b.pubDate))
    .slice(-MAX_NOTIFICATIONS);

  if (newArticles.length === 0) {
    console.log("Nessun nuovo articolo da notificare.");
    return;
  }

  for (const article of newArticles) {
    await sendNotification({
      title: "Nuovo articolo su Vivi Bariano",
      message: article.title,
      url: article.link || SITE_URL,
      image: article.image
    });
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
