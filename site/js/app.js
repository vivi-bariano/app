const MONTHS_IT = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const MONTHS_IT_LONG = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"
];

async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Impossibile caricare ${path}`);
  return res.json();
}

function formatArticleDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return `${d.getDate()} ${MONTHS_IT_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

function renderArticles(container, articles, limit) {
  if (!articles || articles.length === 0) {
    container.innerHTML = '<p class="empty-state">Nessun articolo disponibile al momento. Vai su <a href="https://vivibariano.substack.com" target="_blank" rel="noopener">Substack</a>.</p>';
    return;
  }
  const items = limit ? articles.slice(0, limit) : articles;
  container.innerHTML = items.map(a => `
    <article class="card">
      ${a.image ? `<a href="${a.link}" target="_blank" rel="noopener"><img class="card-image" src="${a.image}" alt="" loading="lazy"></a>` : ""}
      <a class="card-title" href="${a.link}" target="_blank" rel="noopener">${escapeHtml(a.title)}</a>
      <p class="meta">${formatArticleDate(a.pubDate)}</p>
      ${a.excerpt ? `<p class="excerpt">${escapeHtml(a.excerpt)}</p>` : ""}
    </article>
  `).join("");
}

function renderEvents(container, events, { limit, includePast } = {}) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let list = events.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  list = list.filter(e => {
    const d = new Date(e.date);
    return includePast ? d < now : d >= now;
  });
  if (!includePast) list.sort((a, b) => new Date(a.date) - new Date(b.date));
  else list.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (limit) list = list.slice(0, limit);

  if (list.length === 0) {
    container.innerHTML = `<p class="empty-state">${includePast ? "Nessun evento passato." : "Nessun evento in programma al momento."}</p>`;
    return;
  }

  container.innerHTML = list.map(e => {
    const d = new Date(e.date);
    const day = isNaN(d) ? "?" : d.getDate();
    const month = isNaN(d) ? "" : MONTHS_IT[d.getMonth()];
    return `
      <article class="card event-card">
        ${e.image ? `<img class="card-image" src="${e.image}" alt="" loading="lazy">` : ""}
        <div class="event-card-body">
          <div class="event-date"><span class="day">${day}</span><span class="month">${month}</span></div>
          <div>
            <span class="card-title" style="display:block">${escapeHtml(e.title)}</span>
            <p class="meta">${[e.time, e.location].filter(Boolean).join(" &middot; ")}</p>
            ${e.description ? `<p class="excerpt">${escapeHtml(e.description)}</p>` : ""}
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function renderLinkItem(l) {
  return `
    <a class="link-item" href="${l.url}" target="_blank" rel="noopener">
      <span>
        <span class="label">${escapeHtml(l.label)}</span>
        ${l.description ? `<span class="desc">${escapeHtml(l.description)}</span>` : ""}
      </span>
      <span aria-hidden="true">&rarr;</span>
    </a>
  `;
}

function renderLinks(container, links, { limit, grouped } = {}) {
  if (!links || links.length === 0) {
    container.innerHTML = '<p class="empty-state">Nessun link disponibile.</p>';
    return;
  }

  if (!grouped) {
    const items = limit ? links.slice(0, limit) : links;
    container.innerHTML = items.map(renderLinkItem).join("");
    return;
  }

  const categories = [];
  const byCategory = new Map();
  links.forEach(l => {
    const cat = l.category || "Altro";
    if (!byCategory.has(cat)) {
      byCategory.set(cat, []);
      categories.push(cat);
    }
    byCategory.get(cat).push(l);
  });

  container.innerHTML = categories.map(cat => `
    <h3 class="link-category">${escapeHtml(cat)}</h3>
    ${byCategory.get(cat).map(renderLinkItem).join("")}
  `).join("");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function init() {
  const articlesList = document.getElementById("articles-list");
  const eventsPreview = document.getElementById("events-preview");
  const eventsList = document.getElementById("events-list");
  const eventsPast = document.getElementById("events-past");
  const linksPreview = document.getElementById("links-preview");
  const linksList = document.getElementById("links-list");

  if (articlesList) {
    loadJSON("data/articles.json")
      .then(articles => renderArticles(articlesList, articles, 5))
      .catch(() => {
        articlesList.innerHTML = '<p class="empty-state">Impossibile caricare gli articoli. Vai su <a href="https://vivibariano.substack.com" target="_blank" rel="noopener">Substack</a>.</p>';
      });
  }

  if (eventsPreview || eventsList || eventsPast) {
    loadJSON("data/events.json")
      .then(events => {
        if (eventsPreview) renderEvents(eventsPreview, events, { limit: 3 });
        if (eventsList) renderEvents(eventsList, events, {});
        if (eventsPast) renderEvents(eventsPast, events, { includePast: true, limit: 10 });
      })
      .catch(() => {
        const msg = '<p class="empty-state">Impossibile caricare gli eventi.</p>';
        if (eventsPreview) eventsPreview.innerHTML = msg;
        if (eventsList) eventsList.innerHTML = msg;
        if (eventsPast) eventsPast.innerHTML = msg;
      });
  }

  if (linksPreview || linksList) {
    loadJSON("data/links.json")
      .then(links => {
        if (linksPreview) renderLinks(linksPreview, links, { limit: 4 });
        if (linksList) renderLinks(linksList, links, { grouped: true });
      })
      .catch(() => {
        const msg = '<p class="empty-state">Impossibile caricare i link.</p>';
        if (linksPreview) linksPreview.innerHTML = msg;
        if (linksList) linksList.innerHTML = msg;
      });
  }
}

function setupInstallPrompt() {
  const btn = document.getElementById("install-btn");
  const iosHint = document.getElementById("install-hint-ios");
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  if (isIos && !isStandalone && iosHint) {
    const isSafari = !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);
    iosHint.textContent = isSafari
      ? "Per installare l'app: tocca Condividi (icona con la freccia) e poi \"Aggiungi alla schermata Home\"."
      : "Per installare l'app su iPhone apri questo sito in Safari, poi tocca Condividi e \"Aggiungi alla schermata Home\".";
    iosHint.classList.add("visible");
  }

  if (!btn) return;
  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    btn.classList.add("visible");
  });

  btn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    btn.classList.remove("visible");
  });

  window.addEventListener("appinstalled", () => {
    btn.classList.remove("visible");
  });
}

function setupNotifyButton() {
  const btn = document.getElementById("notify-btn");
  if (!btn) return;
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(function (OneSignal) {
    function syncVisibility() {
      const optedIn = OneSignal.User.PushSubscription.optedIn;
      btn.classList.toggle("visible", !optedIn);
    }
    syncVisibility();
    OneSignal.User.PushSubscription.addEventListener("change", syncVisibility);
    btn.addEventListener("click", () => {
      OneSignal.Notifications.requestPermission();
    });
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
}

init();
setupInstallPrompt();
setupNotifyButton();
registerServiceWorker();
