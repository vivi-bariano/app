#!/usr/bin/env node
// Compares events.json before/after a push and sends a push notification
// (via OneSignal) for each event that wasn't there before.
// Usage: node notify-new-events.mjs <before.json> <after.json>

import { readFile } from "node:fs/promises";
import { sendNotification } from "./onesignal.mjs";

const MAX_NOTIFICATIONS = 5;
const SITE_BASE = "https://vivi-bariano.github.io/app/";
const EVENTS_URL = `${SITE_BASE}eventi.html`;

function resolveImage(image) {
  if (!image) return undefined;
  return /^https?:\/\//i.test(image) ? image : `${SITE_BASE}${image}`;
}

const MONTHS_IT = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"
];

function formatDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return `${d.getDate()} ${MONTHS_IT[d.getMonth()]}`;
}

async function readJsonSafe(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return [];
  }
}

function eventKey(e) {
  return `${e.title}|${e.date}`;
}

async function main() {
  const [, , beforePath, afterPath] = process.argv;
  if (!beforePath || !afterPath) {
    throw new Error("Uso: node notify-new-events.mjs <before.json> <after.json>");
  }

  if (!process.env.ONESIGNAL_REST_API_KEY) {
    console.log("ONESIGNAL_REST_API_KEY non impostata: notifiche push saltate.");
    return;
  }

  const before = await readJsonSafe(beforePath);
  const after = await readJsonSafe(afterPath);
  const knownKeys = new Set(before.map(eventKey));

  const newEvents = after
    .filter(e => !knownKeys.has(eventKey(e)))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, MAX_NOTIFICATIONS);

  if (newEvents.length === 0) {
    console.log("Nessun nuovo evento da notificare.");
    return;
  }

  for (const event of newEvents) {
    const when = formatDate(event.date);
    await sendNotification({
      title: "Nuovo evento a Bariano",
      message: when ? `${event.title} — ${when}` : event.title,
      url: EVENTS_URL,
      image: resolveImage(event.image)
    });
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
