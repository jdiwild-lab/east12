import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getFirestore, onSnapshot, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const STORAGE_KEY = "homeShoppingCatalogV1";
const THEME_KEY = "homeShoppingThemeV1";
const SYNC_KEY = "homeShoppingSyncV1";

const CATEGORIES = ["All", "Furniture", "Media/Tech", "Bedding", "Art/Posters"];
const STATUS = ["Need", "Considering", "Purchased"];

const state = {
  items: [],
  budget: 10000,
  filterCategory: "All",
  search: "",
  sort: "newest",
  sync: {
    roomId: "",
    connected: false,
    unsubscribe: null,
    applyingRemote: false,
    lastPushedAt: 0,
  },
};

const els = {
  form: document.getElementById("item-form"),
  link: document.getElementById("item-link"),
  name: document.getElementById("item-name"),
  category: document.getElementById("item-category"),
  status: document.getElementById("item-status"),
  price: document.getElementById("item-price"),
  width: document.getElementById("item-width"),
  depth: document.getElementById("item-depth"),
  height: document.getElementById("item-height"),
  image: document.getElementById("item-image"),
  notes: document.getElementById("item-notes"),
  autofillBtn: document.getElementById("autofill-btn"),
  budgetInput: document.getElementById("budget-input"),
  syncRoomInput: document.getElementById("sync-room-input"),
  syncConnectBtn: document.getElementById("sync-connect-btn"),
  syncDisconnectBtn: document.getElementById("sync-disconnect-btn"),
  syncState: document.getElementById("sync-state"),
  themeSelect: document.getElementById("theme-select"),
  categoryChips: document.getElementById("category-chips"),
  searchInput: document.getElementById("search-input"),
  sortSelect: document.getElementById("sort-select"),
  list: document.getElementById("catalog-list"),
  statusText: document.getElementById("status"),
  statTotal: document.getElementById("stat-total"),
  statNeeded: document.getElementById("stat-needed"),
  statPurchased: document.getElementById("stat-purchased"),
  statSpent: document.getElementById("stat-spent"),
  statRemaining: document.getElementById("stat-remaining"),
};

boot();

function boot() {
  loadTheme();
  loadSyncPrefs();
  loadState();
  wireEvents();
  renderCategoryChips();
  render();
  renderSyncState("Live sync is off.");
}

function wireEvents() {
  els.form.addEventListener("submit", onAddItem);
  els.autofillBtn.addEventListener("click", onAutofill);
  els.budgetInput.addEventListener("change", () => {
    state.budget = Math.max(0, Number(els.budgetInput.value) || 0);
    saveState();
    renderStats();
  });
  els.searchInput.addEventListener("input", () => {
    state.search = els.searchInput.value.trim().toLowerCase();
    renderList();
  });
  els.sortSelect.addEventListener("change", () => {
    state.sort = els.sortSelect.value;
    renderList();
  });
  els.themeSelect.addEventListener("change", () => {
    applyTheme(els.themeSelect.value);
  });
  els.syncConnectBtn.addEventListener("click", onConnectSync);
  els.syncDisconnectBtn.addEventListener("click", onDisconnectSync);
}

function onAddItem(event) {
  event.preventDefault();

  const item = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    name: els.name.value.trim(),
    category: els.category.value,
    status: els.status.value,
    price: Number(els.price.value) || 0,
    widthIn: Number(els.width.value) || 0,
    depthIn: Number(els.depth.value) || 0,
    heightIn: Number(els.height.value) || 0,
    image: els.image.value.trim(),
    link: els.link.value.trim(),
    notes: els.notes.value.trim(),
  };

  if (!item.name) {
    setStatus("Item name is required.");
    return;
  }

  state.items.unshift(item);
  saveState();
  resetForm();
  render();
  setStatus(`Added ${item.name}.`);
}

async function onAutofill() {
  const url = els.link.value.trim();
  if (!url) {
    setStatus("Paste a product link first.");
    return;
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    setStatus("That link is not valid.");
    return;
  }

  els.autofillBtn.disabled = true;
  const before = els.autofillBtn.textContent;
  els.autofillBtn.textContent = "Loading...";

  try {
    const data = await fetchProductMetadata(parsed.href);

    if (!els.name.value.trim() && data.title) {
      els.name.value = data.title;
    }
    if (!(Number(els.price.value) > 0) && Number(data.price) > 0) {
      els.price.value = Number(data.price).toFixed(2);
    }
    if (!(Number(els.width.value) > 0) && Number(data.widthIn) > 0) {
      els.width.value = Number(data.widthIn).toFixed(1);
    }
    if (!(Number(els.depth.value) > 0) && Number(data.depthIn) > 0) {
      els.depth.value = Number(data.depthIn).toFixed(1);
    }
    if (!(Number(els.height.value) > 0) && Number(data.heightIn) > 0) {
      els.height.value = Number(data.heightIn).toFixed(1);
    }
    if (!els.image.value.trim() && data.image) {
      els.image.value = data.image;
    }
    if (data.categoryGuess) {
      els.category.value = data.categoryGuess;
    }

    setStatus(data.foundAny ? "Autofill complete." : "No metadata found for this link. Fill fields manually.");
  } catch {
    setStatus("Could not read metadata from this link. Fill fields manually.");
  } finally {
    els.autofillBtn.disabled = false;
    els.autofillBtn.textContent = before;
  }
}

async function fetchProductMetadata(url) {
  const result = {
    title: "",
    image: "",
    price: 0,
    widthIn: 0,
    depthIn: 0,
    heightIn: 0,
    categoryGuess: guessCategory(url, ""),
    foundAny: false,
  };

  const noembed = await tryFetchJson(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
  if (noembed) {
    result.title = noembed.title || result.title;
    result.image = noembed.thumbnail_url || result.image;
  }

  const html = await tryFetchText(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`)
    || await tryFetchText(`https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`);

  if (html) {
    const meta = parseMetadataFromHtml(html);
    result.title = result.title || meta.title;
    result.image = result.image || meta.image;
    result.price = result.price || meta.price;

    const dims = parseDimensionsFromText(meta.textForDimensions || html);
    result.widthIn = dims.widthIn;
    result.depthIn = dims.depthIn;
    result.heightIn = dims.heightIn;
  }

  result.categoryGuess = guessCategory(url, result.title || "");
  result.foundAny = Boolean(result.title || result.image || result.price || result.widthIn || result.depthIn || result.heightIn);
  return result;
}

async function tryFetchJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function tryFetchText(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function parseMetadataFromHtml(html) {
  const out = { title: "", image: "", price: 0, textForDimensions: "" };

  const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) out.title = decodeHtml(titleMatch[1].trim());

  const imageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
  if (imageMatch) out.image = imageMatch[1].trim();

  const priceMatch = html.match(/product:price:amount["'][^>]+content=["']([0-9.,]+)/i)
    || html.match(/"price"\s*:\s*"?([0-9]+(?:\.[0-9]{1,2})?)"?/i)
    || html.match(/\$\s*([0-9]{1,4}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/);
  if (priceMatch) out.price = Number(priceMatch[1].replaceAll(",", "")) || 0;

  const ldJson = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1])
    .join("\n");
  out.textForDimensions = `${html}\n${ldJson}`;

  return out;
}

function parseDimensionsFromText(text) {
  const cleaned = String(text)
    .replaceAll(/&quot;/gi, '"')
    .replaceAll(/&nbsp;/gi, " ")
    .replaceAll(/\s+/g, " ");

  const xPattern = cleaned.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:in|inch|\")\s*[x×]\s*([0-9]+(?:\.[0-9]+)?)\s*(?:in|inch|\")\s*[x×]\s*([0-9]+(?:\.[0-9]+)?)\s*(?:in|inch|\")/i);
  if (xPattern) {
    return {
      widthIn: Number(xPattern[1]) || 0,
      depthIn: Number(xPattern[2]) || 0,
      heightIn: Number(xPattern[3]) || 0,
    };
  }

  const w = cleaned.match(/(?:width|w)\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:in|inch|\")/i);
  const d = cleaned.match(/(?:depth|d)\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:in|inch|\")/i);
  const h = cleaned.match(/(?:height|h)\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:in|inch|\")/i);

  return {
    widthIn: w ? Number(w[1]) : 0,
    depthIn: d ? Number(d[1]) : 0,
    heightIn: h ? Number(h[1]) : 0,
  };
}

function guessCategory(url, title) {
  const s = `${url} ${title}`.toLowerCase();
  if (/tv|monitor|speaker|soundbar|router|console|apple|lg|samsung|tech|media/.test(s)) return "Media/Tech";
  if (/duvet|sheet|mattress|pillows?|comforter|bedding|bed/.test(s)) return "Bedding";
  if (/poster|print|frame|wall art|artwork|canvas/.test(s)) return "Art/Posters";
  return "Furniture";
}

function decodeHtml(text) {
  const txt = document.createElement("textarea");
  txt.innerHTML = text;
  return txt.value;
}

function render() {
  renderStats();
  renderList();
}

function renderCategoryChips() {
  els.categoryChips.innerHTML = "";
  for (const cat of CATEGORIES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chip${state.filterCategory === cat ? " active" : ""}`;
    button.textContent = cat;
    button.addEventListener("click", () => {
      state.filterCategory = cat;
      renderCategoryChips();
      renderList();
    });
    els.categoryChips.appendChild(button);
  }
}

function renderStats() {
  const total = state.items.length;
  const needed = state.items.filter((item) => item.status === "Need").length;
  const purchasedItems = state.items.filter((item) => item.status === "Purchased");
  const purchased = purchasedItems.length;
  const spent = purchasedItems.reduce((sum, item) => sum + (item.price || 0), 0);
  const remaining = state.budget - spent;

  els.statTotal.textContent = String(total);
  els.statNeeded.textContent = String(needed);
  els.statPurchased.textContent = String(purchased);
  els.statSpent.textContent = money(spent);
  els.statRemaining.textContent = money(remaining);
  els.budgetInput.value = String(state.budget);
}

function renderList() {
  const list = applyFiltersAndSort(state.items);
  els.list.innerHTML = "";

  if (!list.length) {
    els.list.innerHTML = `<div class="empty">No products match current filters.</div>`;
    return;
  }

  for (const item of list) {
    const card = document.createElement("article");
    card.className = "item-card";

    const image = item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" />` : `<img alt="No image" />`;
    const dims = formatDimensions(item.widthIn, item.depthIn, item.heightIn);

    card.innerHTML = `
      ${image}
      <div>
        <div class="item-head">
          <h4>${escapeHtml(item.name)}</h4>
          <span class="price">${money(item.price)}</span>
        </div>
        <p class="meta">${escapeHtml(item.category)} • ${escapeHtml(item.status)}</p>
        <p class="meta">${dims}</p>
        <p class="notes">${escapeHtml(item.notes || "No notes")}</p>
        <div class="tag-row">
          <span class="tag">Added ${new Date(item.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
      <div class="actions">
        ${item.link ? `<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">Open Link</a>` : ""}
        <button data-action="status" data-id="${item.id}" class="ghost">Next Status</button>
        <button data-action="delete" data-id="${item.id}">Delete</button>
      </div>
    `;

    els.list.appendChild(card);
  }

  els.list.querySelectorAll("button[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.id;
      if (button.dataset.action === "delete") {
        state.items = state.items.filter((item) => item.id !== id);
      }
      if (button.dataset.action === "status") {
        const target = state.items.find((item) => item.id === id);
        if (target) {
          const idx = STATUS.indexOf(target.status);
          target.status = STATUS[(idx + 1) % STATUS.length];
        }
      }
      saveState();
      render();
      syncPushState();
    });
  });
}

function applyFiltersAndSort(items) {
  const filtered = items.filter((item) => {
    const byCategory = state.filterCategory === "All" || item.category === state.filterCategory;
    const haystack = `${item.name} ${item.notes} ${item.category}`.toLowerCase();
    const bySearch = !state.search || haystack.includes(state.search);
    return byCategory && bySearch;
  });

  if (state.sort === "priceAsc") {
    filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
  } else if (state.sort === "priceDesc") {
    filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
  } else if (state.sort === "name") {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    filtered.sort((a, b) => b.createdAt - a.createdAt);
  }

  return filtered;
}

function normalizeItem(item) {
  if (!item || typeof item !== "object") return null;
  const name = String(item.name || "").trim();
  if (!name) return null;
  return {
    id: String(item.id || crypto.randomUUID()),
    createdAt: Number(item.createdAt) || Date.now(),
    name,
    category: CATEGORIES.includes(item.category) && item.category !== "All" ? item.category : "Furniture",
    status: STATUS.includes(item.status) ? item.status : "Need",
    price: Number(item.price) || 0,
    widthIn: Number(item.widthIn) || 0,
    depthIn: Number(item.depthIn) || 0,
    heightIn: Number(item.heightIn) || 0,
    image: String(item.image || "").trim(),
    link: String(item.link || "").trim(),
    notes: String(item.notes || "").trim(),
  };
}

function loadState() {
  if (state.items.length) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    state.items = (Array.isArray(data.items) ? data.items : []).map(normalizeItem).filter(Boolean);
    state.budget = Number(data.budget) >= 0 ? Number(data.budget) : state.budget;
    els.sortSelect.value = state.sort;
  } catch {
    // Ignore corrupted local data.
  }
}

function loadTheme() {
  const stored = localStorage.getItem(THEME_KEY) || "slate";
  applyTheme(stored, false);
}

function loadSyncPrefs() {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (typeof data.roomId === "string") {
      state.sync.roomId = data.roomId;
      els.syncRoomInput.value = data.roomId;
    }
  } catch {
    // ignore invalid sync prefs
  }
}

function saveSyncPrefs() {
  localStorage.setItem(SYNC_KEY, JSON.stringify({ roomId: state.sync.roomId }));
}

function applyTheme(theme, persist = true) {
  const allowed = new Set(["slate", "charcoal", "navy"]);
  const next = allowed.has(theme) ? theme : "slate";
  document.documentElement.setAttribute("data-theme", next);
  if (els.themeSelect) els.themeSelect.value = next;
  if (persist) localStorage.setItem(THEME_KEY, next);
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      budget: state.budget,
      items: state.items,
    })
  );
  syncPushState();
}

function resetForm() {
  els.form.reset();
  els.price.value = "0";
  els.width.value = "0";
  els.depth.value = "0";
  els.height.value = "0";
  els.category.value = "Furniture";
  els.status.value = "Need";
}

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);
}

function formatDimensions(w, d, h) {
  if (!(w > 0) && !(d > 0) && !(h > 0)) return "No size yet";
  return `H ${h || "?"}\" • W ${w || "?"}\" • D ${d || "?"}\"`;
}

function setStatus(text) {
  els.statusText.textContent = text;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

let firebaseApp = null;
let firebaseAuth = null;
let firestore = null;
let firebaseUid = "";

async function ensureFirebaseReady() {
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey || !cfg.projectId || !cfg.appId) {
    throw new Error("Missing firebase-config.js (FIREBASE_CONFIG)");
  }
  if (!firebaseApp) {
    firebaseApp = initializeApp(cfg);
    firebaseAuth = getAuth(firebaseApp);
    firestore = getFirestore(firebaseApp);
    await signInAnonymously(firebaseAuth);
    firebaseUid = firebaseAuth.currentUser?.uid || "";
  }
}

async function onConnectSync() {
  const roomId = sanitizeRoomId(els.syncRoomInput.value);
  if (!roomId) {
    renderSyncState("Enter a room ID first (letters, numbers, dash).");
    return;
  }
  els.syncRoomInput.value = roomId;
  try {
    await ensureFirebaseReady();
  } catch (err) {
    renderSyncState(`Firebase setup required: ${err.message}`);
    return;
  }

  onDisconnectSync(false);
  state.sync.roomId = roomId;
  saveSyncPrefs();

  const roomRef = doc(firestore, "catalogRooms", roomId);
  state.sync.unsubscribe = onSnapshot(roomRef, (snapshot) => {
    const data = snapshot.data();
    if (!data || !Array.isArray(data.items)) return;
    const remoteItems = data.items.map(normalizeItem).filter(Boolean);
    const remoteBudget = Number(data.budget);

    state.sync.applyingRemote = true;
    state.items = remoteItems;
    if (remoteBudget >= 0) state.budget = remoteBudget;
    saveState();
    render();
    state.sync.applyingRemote = false;
    renderSyncState(`Live sync connected: ${roomId}`);
  });

  state.sync.connected = true;
  renderSyncState(`Connecting to ${roomId}...`);
  await syncPushState(true);
}

function onDisconnectSync(showMessage = true) {
  if (state.sync.unsubscribe) {
    state.sync.unsubscribe();
    state.sync.unsubscribe = null;
  }
  state.sync.connected = false;
  state.sync.applyingRemote = false;
  if (showMessage) renderSyncState("Live sync is off.");
}

async function syncPushState(force = false) {
  if (!state.sync.connected || state.sync.applyingRemote || !firestore || !state.sync.roomId) return;
  const now = Date.now();
  if (!force && now - state.sync.lastPushedAt < 500) return;
  state.sync.lastPushedAt = now;

  try {
    const roomRef = doc(firestore, "catalogRooms", state.sync.roomId);
    await setDoc(
      roomRef,
      {
        budget: state.budget,
        items: state.items,
        updatedAt: serverTimestamp(),
        updatedBy: firebaseUid || "anonymous",
      },
      { merge: true }
    );
  } catch {
    renderSyncState("Sync write failed. Check Firebase rules/config.");
  }
}

function sanitizeRoomId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9-_]/g, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/^-|-$/g, "");
}

function renderSyncState(text) {
  if (!els.syncState) return;
  els.syncState.textContent = text;
}
