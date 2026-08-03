#!/usr/bin/env node
// Shared helper to send a push notification via the OneSignal REST API.
// Requires ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY in the environment.

export async function sendNotification({ title, message, url, image }) {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !apiKey) {
    throw new Error("ONESIGNAL_APP_ID o ONESIGNAL_REST_API_KEY mancanti nell'ambiente");
  }

  const body = {
    app_id: appId,
    included_segments: ["Subscribed Users"],
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
  console.log(`Notifica inviata: "${title}" (id ${data.id || "?"})`);
  return data;
}
