#!/usr/bin/env node
// Shared helper to send a push notification via the OneSignal REST API.
// Requires ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY in the environment.
//
// Targets subscribers directly by id instead of the "Subscribed Users"
// segment: for this app that segment consistently rejects real, active
// subscribers ("All included players are not subscribed"), while sending
// straight to a subscription id works reliably.

async function getSubscribedPlayerIds(appId, apiKey) {
  const res = await fetch(`https://onesignal.com/api/v1/players?app_id=${appId}&limit=300`, {
    headers: { "Authorization": `Key ${apiKey}` }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`OneSignal players API error ${res.status}: ${JSON.stringify(data)}`);
  }
  return (data.players || [])
    .filter(p => p.identifier)
    .map(p => p.id);
}

export async function sendNotification({ title, message, url, image }) {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !apiKey) {
    throw new Error("ONESIGNAL_APP_ID o ONESIGNAL_REST_API_KEY mancanti nell'ambiente");
  }

  const subscriptionIds = await getSubscribedPlayerIds(appId, apiKey);
  if (subscriptionIds.length === 0) {
    console.log(`Nessun iscritto attivo: notifica "${title}" non inviata.`);
    return null;
  }

  const body = {
    app_id: appId,
    include_subscription_ids: subscriptionIds,
    headings: { en: title },
    contents: { en: message },
    url
  };
  if (image) {
    body.big_picture = image;
    body.chrome_web_image = image;
  }

  const res = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Authorization": `Key ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`OneSignal API error ${res.status}: ${JSON.stringify(data)}`);
  }
  console.log(`Risposta OneSignal per "${title}": ${JSON.stringify(data)}`);
  return data;
}
