const WALL_THICKNESS = 0.3;
const POSITION_SNAP = 0.25;
const ROTATION_STEP = 90;
const COLLISION_GAP = 0.2;

const DIM = {
  bedroomWidth: 10 + 7 / 12,
  livingWidth: 13.5,
  kitchenReturn: 4 + 7 / 12,
  entrySpan: 9 + 7 / 12,
  totalDepth: 30,
  rightDrop: 15,
  kitchenTopRise: 4.5,
  hallDepth: 16,
  dividerRun: 11 + 11 / 12,
};

const DEFAULT_CATALOG_ITEMS = [
  {
    id: "cat-sofa-1",
    name: "IKEA KIVIK Sofa",
    category: "Furniture",
    width: 7.5,
    depth: 3.1,
    height: 2.9,
    color: "#8f4a31",
    price: 899,
    image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=480&q=80",
    link: "https://www.ikea.com/us/en/search/?q=KIVIK",
  },
  {
    id: "cat-tv-1",
    name: "LG 65in OLED TV",
    category: "Tech",
    width: 4.8,
    depth: 0.35,
    height: 2.8,
    color: "#1f2937",
    price: 1699,
    image: "https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=480&q=80",
    link: "https://www.bestbuy.com/site/searchpage.jsp?st=65+oled",
  },
  {
    id: "cat-bed-1",
    name: "CB2 Queen Bed Frame",
    category: "Furniture",
    width: 5.2,
    depth: 6.8,
    height: 2,
    color: "#6d4c41",
    price: 799,
    image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=480&q=80",
    link: "https://www.cb2.com/furniture/beds/1",
  },
];

const state = {
  furniture: normalizeFurniture(load("apartmentPlannerFurniture", [])),
  tracker: load("apartmentPlannerTracker", []),
  catalog: loadCatalog(),
  selectedId: null,
};

const viewer = document.getElementById("viewer");
const statusEl = document.getElementById("status");
const floorPoints = buildMeasuredFloorPlan();
const interiorWalls = buildInteriorWallSegments();

const extents = getExtents(floorPoints);
const center = { x: (extents.minX + extents.maxX) / 2, y: (extents.minY + extents.maxY) / 2 };

let svg = null;
let furnitureLayer = null;
const drag = { active: false, item: null, offsetX: 0, offsetY: 0 };

renderLayout();
renderCatalog();
renderTracker();
rebuildFurniture();

document.getElementById("furniture-form").addEventListener("submit", onAddFurniture);
document.getElementById("tracker-form").addEventListener("submit", onAddTrackerItem);
document.getElementById("catalog-import-form").addEventListener("submit", onCatalogImport);
document.getElementById("catalog-reset-btn").addEventListener("click", onCatalogReset);
window.addEventListener("keydown", onKeyDown);
window.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerup", onPointerUp);

function renderLayout() {
  viewer.innerHTML = "";
  const margin = 2;
  const width = extents.maxX - extents.minX + margin * 2;
  const height = extents.maxY - extents.minY + margin * 2;

  svg = svgEl("svg", {
    class: "plan-svg",
    viewBox: `${extents.minX - margin} ${extents.minY - margin} ${width} ${height}`,
    preserveAspectRatio: "xMidYMid meet",
  });

  const grid = svgEl("pattern", { id: "grid", width: 1, height: 1, patternUnits: "userSpaceOnUse" });
  grid.appendChild(svgEl("path", { d: "M 1 0 L 0 0 0 1", fill: "none", stroke: "#e9edf3", "stroke-width": "0.03" }));

  const defs = svgEl("defs");
  defs.appendChild(grid);
  svg.appendChild(defs);

  svg.appendChild(
    svgEl("rect", {
      x: extents.minX - margin,
      y: extents.minY - margin,
      width,
      height,
      fill: "url(#grid)",
    })
  );

  svg.appendChild(
    svgEl("polygon", {
      points: floorPoints.map((p) => `${p.x},${p.y}`).join(" "),
      fill: "#f8f3e8",
      stroke: "#153f75",
      "stroke-width": "0.24",
      "stroke-linejoin": "round",
    })
  );

  for (const seg of interiorWalls) {
    svg.appendChild(
      svgEl("line", {
        x1: seg.a.x,
        y1: seg.a.y,
        x2: seg.b.x,
        y2: seg.b.y,
        stroke: "#315d96",
        "stroke-width": "0.2",
        "stroke-linecap": "round",
      })
    );
  }

  for (const label of getRoomLabels()) {
    svg.appendChild(
      svgEl("text", {
        x: label.x,
        y: label.y,
        class: "room-label",
      }, label.text)
    );
  }

  for (const arc of getDoorArcs()) {
    svg.appendChild(
      svgEl("path", {
        d: describeArc(arc.cx, arc.cy, arc.r, arc.start, arc.end),
        fill: "none",
        stroke: "#64748b",
        "stroke-width": "0.08",
      })
    );
  }

  furnitureLayer = svgEl("g", { id: "furniture-layer" });
  svg.appendChild(furnitureLayer);
  viewer.appendChild(svg);
}

function rebuildFurniture() {
  furnitureLayer.innerHTML = "";

  for (const item of state.furniture) {
    const group = svgEl("g", {
      transform: `translate(${item.x} ${item.y}) rotate(${item.rotation})`,
      class: `furniture-item${item.id === state.selectedId ? " selected" : ""}`,
      "data-id": item.id,
    });

    const rect = svgEl("rect", {
      x: -item.width / 2,
      y: -item.depth / 2,
      width: item.width,
      height: item.depth,
      rx: 0.08,
      fill: item.color,
      stroke: "#111827",
      "stroke-width": "0.06",
    });

    const txt = svgEl("text", { x: 0, y: 0.08, class: "furniture-label" }, item.name);

    group.appendChild(rect);
    group.appendChild(txt);
    group.addEventListener("pointerdown", (event) => onPointerDown(event, item.id));
    furnitureLayer.appendChild(group);
  }
}

function onAddFurniture(event) {
  event.preventDefault();
  const item = {
    id: crypto.randomUUID(),
    name: document.getElementById("item-name").value.trim(),
    width: Number(document.getElementById("item-width").value),
    depth: Number(document.getElementById("item-depth").value),
    height: Number(document.getElementById("item-height").value),
    color: document.getElementById("item-color").value,
    x: center.x,
    y: center.y,
    rotation: 0,
  };

  if (!isValidPlacement(item, item.id)) {
    setStatus("Placement blocked: collides with a wall or another item.");
    return;
  }

  state.furniture.push(item);
  save("apartmentPlannerFurniture", state.furniture);
  rebuildFurniture();
  setStatus(`Placed ${item.name}.`);

  event.target.reset();
  document.getElementById("item-width").value = 6;
  document.getElementById("item-depth").value = 3;
  document.getElementById("item-height").value = 3;
  document.getElementById("item-color").value = "#c46f37";
}

function onPointerDown(event, id) {
  event.preventDefault();
  const item = findFurniture(id);
  if (!item) return;

  state.selectedId = id;
  const p = clientToSvg(event);
  drag.active = true;
  drag.item = item;
  drag.offsetX = item.x - p.x;
  drag.offsetY = item.y - p.y;
  rebuildFurniture();
}

function onPointerMove(event) {
  if (!drag.active || !drag.item) return;
  const p = clientToSvg(event);

  const candidate = {
    ...drag.item,
    x: snap(p.x + drag.offsetX, POSITION_SNAP),
    y: snap(p.y + drag.offsetY, POSITION_SNAP),
  };

  if (!isValidPlacement(candidate, drag.item.id)) {
    return;
  }

  drag.item.x = candidate.x;
  drag.item.y = candidate.y;
  save("apartmentPlannerFurniture", state.furniture);
  rebuildFurniture();
}

function onPointerUp() {
  drag.active = false;
  drag.item = null;
}

function onKeyDown(event) {
  if (!state.selectedId) return;
  const item = findFurniture(state.selectedId);
  if (!item) return;

  if (event.key.toLowerCase() === "r") {
    const candidate = { ...item, rotation: (item.rotation + ROTATION_STEP) % 360 };
    if (!isValidPlacement(candidate, item.id)) {
      setStatus("Rotate blocked: collision detected.");
      return;
    }
    item.rotation = candidate.rotation;
    save("apartmentPlannerFurniture", state.furniture);
    rebuildFurniture();
    setStatus("");
  }

  if (event.key === "Delete" || event.key === "Backspace") {
    state.furniture = state.furniture.filter((f) => f.id !== state.selectedId);
    state.selectedId = null;
    save("apartmentPlannerFurniture", state.furniture);
    rebuildFurniture();
  }
}

function isValidPlacement(candidate, ignoreId) {
  const candidatePoly = getItemPolygon(candidate, COLLISION_GAP / 2);

  for (const corner of candidatePoly) {
    if (!pointInPolygon(corner, floorPoints)) return false;
  }

  for (const wall of interiorWalls) {
    const length = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
    const cx = (wall.a.x + wall.b.x) / 2;
    const cy = (wall.a.y + wall.b.y) / 2;
    const angle = toDegrees(Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x));
    const wallPoly = getRectPolygon(cx, cy, length, WALL_THICKNESS + COLLISION_GAP, angle);
    if (polygonsIntersect(candidatePoly, wallPoly)) return false;
  }

  for (const other of state.furniture) {
    if (other.id === ignoreId) continue;
    const otherPoly = getItemPolygon(other, COLLISION_GAP / 2);
    if (polygonsIntersect(candidatePoly, otherPoly)) return false;
  }

  return true;
}

function getItemPolygon(item, inflate = 0) {
  return getRectPolygon(item.x, item.y, item.width + inflate, item.depth + inflate, item.rotation);
}

function getRectPolygon(cx, cy, width, depth, rotationDeg) {
  const rad = (rotationDeg * Math.PI) / 180;
  const hw = width / 2;
  const hd = depth / 2;
  const corners = [
    { x: -hw, y: -hd },
    { x: hw, y: -hd },
    { x: hw, y: hd },
    { x: -hw, y: hd },
  ];

  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return corners.map((p) => ({
    x: cx + p.x * cos - p.y * sin,
    y: cy + p.x * sin + p.y * cos,
  }));
}

function polygonsIntersect(polyA, polyB) {
  const axes = [...getAxes(polyA), ...getAxes(polyB)];
  for (const axis of axes) {
    const a = project(polyA, axis);
    const b = project(polyB, axis);
    if (a.max < b.min || b.max < a.min) return false;
  }
  return true;
}

function getAxes(poly) {
  const axes = [];
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const edge = { x: b.x - a.x, y: b.y - a.y };
    const normal = { x: -edge.y, y: edge.x };
    const length = Math.hypot(normal.x, normal.y);
    if (length > 0) axes.push({ x: normal.x / length, y: normal.y / length });
  }
  return axes;
}

function project(poly, axis) {
  let min = Infinity;
  let max = -Infinity;
  for (const p of poly) {
    const value = p.x * axis.x + p.y * axis.y;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return { min, max };
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function renderTracker() {
  const container = document.getElementById("tracker-list");
  container.innerHTML = "";

  for (const item of state.tracker) {
    const row = document.createElement("div");
    row.className = "tracker-item";
    const total = item.qty * item.price;

    row.innerHTML = `
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <small>${item.qty} x $${item.price.toFixed(2)} = $${total.toFixed(2)}</small>
        <small>${escapeHtml(item.notes || "-")}</small>
      </div>
      <div class="tracker-actions">
        <button data-action="toggle" data-id="${item.id}">${item.status === "needed" ? "Mark Purchased" : "Mark Needed"}</button>
        <button data-action="delete" data-id="${item.id}" class="ghost">Delete</button>
      </div>
    `;

    row.classList.toggle("purchased", item.status === "purchased");
    container.appendChild(row);
  }

  container.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.id;
      if (button.dataset.action === "toggle") {
        const target = state.tracker.find((entry) => entry.id === id);
        if (target) target.status = target.status === "needed" ? "purchased" : "needed";
      }

      if (button.dataset.action === "delete") {
        state.tracker = state.tracker.filter((entry) => entry.id !== id);
      }

      save("apartmentPlannerTracker", state.tracker);
      renderTracker();
    });
  });

  const purchased = state.tracker.filter((i) => i.status === "purchased");
  const needed = state.tracker.filter((i) => i.status === "needed");

  const purchasedTotal = purchased.reduce((sum, i) => sum + i.qty * i.price, 0);
  const neededTotal = needed.reduce((sum, i) => sum + i.qty * i.price, 0);

  document.getElementById("totals").innerHTML = `
    <div><strong>Purchased:</strong> ${purchased.length} items ($${purchasedTotal.toFixed(2)})</div>
    <div><strong>Still Needed:</strong> ${needed.length} items ($${neededTotal.toFixed(2)})</div>
  `;
}

function renderCatalog() {
  const catalog = document.getElementById("catalog");
  catalog.innerHTML = "";

  for (const item of state.catalog) {
    const card = document.createElement("article");
    card.className = "catalog-item";
    card.innerHTML = `
      <img src="${item.image}" alt="${escapeHtml(item.name)}" loading="lazy" />
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <small>${item.category} • ${item.width.toFixed(1)}' x ${item.depth.toFixed(1)}' • $${item.price.toFixed(2)}</small>
      </div>
      <div class="catalog-actions">
        <button data-action="place" data-id="${item.id}">Place</button>
        <button data-action="track" data-id="${item.id}" class="ghost">Track</button>
        <a href="${item.link}" target="_blank" rel="noopener noreferrer">Open</a>
      </div>
    `;
    catalog.appendChild(card);
  }

  catalog.querySelectorAll("button[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = state.catalog.find((entry) => entry.id === button.dataset.id);
      if (!item) return;

      if (button.dataset.action === "place") {
        const placed = {
          id: crypto.randomUUID(),
          name: item.name,
          width: item.width,
          depth: item.depth,
          height: item.height,
          color: item.color,
          x: center.x,
          y: center.y,
          rotation: 0,
        };

        if (!isValidPlacement(placed, placed.id)) {
          setStatus("Catalog item cannot be placed at center.");
          return;
        }

        state.furniture.push(placed);
        save("apartmentPlannerFurniture", state.furniture);
        rebuildFurniture();
      }

      if (button.dataset.action === "track") {
        state.tracker.push({
          id: crypto.randomUUID(),
          name: item.name,
          qty: 1,
          price: item.price,
          notes: item.link,
          status: "needed",
        });
        save("apartmentPlannerTracker", state.tracker);
        renderTracker();
      }
    });
  });
}

function onCatalogImport(event) {
  event.preventDefault();
  const input = document.getElementById("catalog-import-input");
  const text = input.value.trim();
  if (!text) {
    setStatus("Paste CSV/JSON rows before importing.");
    return;
  }

  const parsed = parseCatalogText(text);
  if (!parsed.length) {
    setStatus("No valid rows imported. Required: name,width,depth,height.");
    return;
  }

  const existing = new Set(state.catalog.map((item) => normalizeKey(item.name, item.link)));
  let added = 0;
  for (const item of parsed) {
    const key = normalizeKey(item.name, item.link);
    if (existing.has(key)) continue;
    existing.add(key);
    state.catalog.push(item);
    added += 1;
  }

  save("apartmentPlannerCatalog", state.catalog);
  renderCatalog();
  input.value = "";
  setStatus(`Catalog import complete: ${added} item(s) added.`);
}

function onCatalogReset() {
  state.catalog = DEFAULT_CATALOG_ITEMS.map((item) => ({ ...item }));
  save("apartmentPlannerCatalog", state.catalog);
  renderCatalog();
}

function parseCatalogText(text) {
  if (text.startsWith("[") || text.startsWith("{")) {
    try {
      const json = JSON.parse(text);
      const list = Array.isArray(json) ? json : [json];
      return list.map(normalizeCatalogItem).filter(Boolean);
    } catch {
      return [];
    }
  }

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];

  const header = parseCSVLine(lines[0]).map((v) => v.toLowerCase());
  const result = [];

  for (const line of lines.slice(1)) {
    const cols = parseCSVLine(line);
    const row = {};
    for (let i = 0; i < header.length; i += 1) row[header[i]] = cols[i] ?? "";
    const item = normalizeCatalogItem(row);
    if (item) result.push(item);
  }

  return result;
}

function parseCSVLine(line) {
  const out = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }

  out.push(current.trim());
  return out;
}

function normalizeCatalogItem(row) {
  const name = String(row.name ?? "").trim();
  if (!name) return null;

  const width = Number(row.width);
  const depth = Number(row.depth);
  const height = Number(row.height);
  if (!(width > 0 && depth > 0 && height > 0)) return null;

  const color = validHex(String(row.color ?? "#7b5a3a").trim()) ? String(row.color).trim() : "#7b5a3a";
  const price = Number(row.price);

  return {
    id: crypto.randomUUID(),
    name,
    category: String(row.category ?? "Furniture").trim() || "Furniture",
    width,
    depth,
    height,
    color,
    price: Number.isFinite(price) && price >= 0 ? price : 0,
    link: String(row.link ?? "https://www.google.com/search?q=furniture").trim() || "https://www.google.com/search?q=furniture",
    image: String(row.image ?? "").trim() || "https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=480&q=80",
  };
}

function onAddTrackerItem(event) {
  event.preventDefault();
  state.tracker.push({
    id: crypto.randomUUID(),
    name: document.getElementById("tracker-name").value.trim(),
    qty: Number(document.getElementById("tracker-qty").value),
    price: Number(document.getElementById("tracker-price").value),
    notes: document.getElementById("tracker-notes").value.trim(),
    status: "needed",
  });
  save("apartmentPlannerTracker", state.tracker);
  renderTracker();
  event.target.reset();
  document.getElementById("tracker-qty").value = 1;
  document.getElementById("tracker-price").value = 0;
}

function buildMeasuredFloorPlan() {
  return centerRawPoints(getRawFloorPlanPoints());
}

function buildInteriorWallSegments() {
  const toCentered = rawToCenteredFactory();
  const xEntryRight = DIM.bedroomWidth + DIM.livingWidth;
  const zEntryCloset = DIM.totalDepth - 5.2;

  return [
    { a: toCentered(DIM.bedroomWidth, 0), b: toCentered(DIM.bedroomWidth, DIM.hallDepth) },
    { a: toCentered(DIM.bedroomWidth + 1.15, 2.2), b: toCentered(DIM.bedroomWidth + 1.15, DIM.dividerRun) },
    { a: toCentered(DIM.bedroomWidth + 1.15, DIM.dividerRun), b: toCentered(DIM.bedroomWidth, DIM.dividerRun) },
    { a: toCentered(xEntryRight, DIM.rightDrop), b: toCentered(xEntryRight, DIM.totalDepth) },
    { a: toCentered(11.0, zEntryCloset), b: toCentered(xEntryRight - DIM.entrySpan, zEntryCloset) },
  ];
}

function getRawFloorPlanPoints() {
  const xEntryRight = DIM.bedroomWidth + DIM.livingWidth;
  const xEntryLeft = xEntryRight - DIM.entrySpan;
  const xRightOuter = xEntryRight + DIM.kitchenReturn;
  const zEntryNotchTop = DIM.totalDepth - 2.8;
  const zBathNotchTop = DIM.totalDepth - 5.2;

  return [
    { x: 0, y: 0 },
    { x: xEntryRight, y: 0 },
    { x: xEntryRight, y: -DIM.kitchenTopRise },
    { x: xRightOuter, y: -DIM.kitchenTopRise },
    { x: xRightOuter, y: DIM.rightDrop },
    { x: xEntryRight, y: DIM.rightDrop },
    { x: xEntryRight, y: DIM.totalDepth },
    { x: xEntryLeft, y: DIM.totalDepth },
    { x: xEntryLeft, y: zEntryNotchTop },
    { x: 11.0, y: zEntryNotchTop },
    { x: 11.0, y: zBathNotchTop },
    { x: 9.0, y: zBathNotchTop },
    { x: 9.0, y: DIM.totalDepth },
    { x: 0, y: DIM.totalDepth },
  ];
}

function centerRawPoints(raw) {
  const ext = getExtents(raw);
  const cx = (ext.minX + ext.maxX) / 2;
  const cy = (ext.minY + ext.maxY) / 2;
  return raw.map((p) => ({ x: p.x - cx, y: p.y - cy }));
}

function rawToCenteredFactory() {
  const ext = getExtents(getRawFloorPlanPoints());
  const cx = (ext.minX + ext.maxX) / 2;
  const cy = (ext.minY + ext.maxY) / 2;
  return (x, y) => ({ x: x - cx, y: y - cy });
}

function getRoomLabels() {
  const toCentered = rawToCenteredFactory();
  return [
    { text: "Bedroom", ...toCentered(4.8, 10.5) },
    { text: "Living Room", ...toCentered(16.4, 11.2) },
    { text: "Kitchen", ...toCentered(26.5, 2.8) },
    { text: "Bathroom", ...toCentered(3.8, 27.2) },
    { text: "Entry", ...toCentered(16.2, 27.4) },
  ];
}

function getDoorArcs() {
  const toCentered = rawToCenteredFactory();
  const xEntryRight = DIM.bedroomWidth + DIM.livingWidth;
  const xEntryLeft = xEntryRight - DIM.entrySpan;

  return [
    withCentered(10.58, 16.0, 1.2, 90, 180),
    withCentered(11.2, DIM.totalDepth - 5.2, 1.1, -90, 0),
    withCentered(xEntryRight, DIM.totalDepth - 3.4, 1.2, 180, 270),
    withCentered(xEntryLeft + 1.2, DIM.totalDepth, 1.15, -90, 0),
  ];

  function withCentered(x, y, r, start, end) {
    const p = toCentered(x, y);
    return { cx: p.x, cy: p.y, r, start, end };
  }
}

function clientToSvg(event) {
  const pt = svg.createSVGPoint();
  pt.x = event.clientX;
  pt.y = event.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

function describeArc(cx, cy, r, startDeg, endDeg) {
  const start = polar(cx, cy, r, endDeg);
  const end = polar(cx, cy, r, startDeg);
  const largeArcFlag = Math.abs(endDeg - startDeg) <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function polar(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function svgEl(tag, attrs = {}, text = "") {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  if (text) el.textContent = text;
  return el;
}

function normalizeFurniture(items) {
  return items
    .map((item) => ({
      ...item,
      y: Number.isFinite(item.y) ? item.y : Number.isFinite(item.z) ? item.z : center.y,
      rotation: Number.isFinite(item.rotation) ? item.rotation : Number.isFinite(item.rotationY) ? toDegrees(item.rotationY) : 0,
    }))
    .filter((item) => item.width > 0 && item.depth > 0);
}

function toDegrees(rad) {
  return (rad * 180) / Math.PI;
}

function findFurniture(id) {
  return state.furniture.find((f) => f.id === id) || null;
}

function loadCatalog() {
  const stored = load("apartmentPlannerCatalog", []);
  if (Array.isArray(stored) && stored.length) return stored.map(normalizeCatalogItem).filter(Boolean);
  return DEFAULT_CATALOG_ITEMS.map((item) => ({ ...item }));
}

function getExtents(points) {
  return points.reduce(
    (acc, p) => ({
      minX: Math.min(acc.minX, p.x),
      maxX: Math.max(acc.maxX, p.x),
      minY: Math.min(acc.minY, p.y),
      maxY: Math.max(acc.maxY, p.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
  );
}

function setStatus(text) {
  statusEl.textContent = text;
}

function validHex(value) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

function normalizeKey(name, link) {
  return `${String(name).trim().toLowerCase()}|${String(link).trim().toLowerCase()}`;
}

function snap(value, step) {
  return Math.round(value / step) * step;
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
