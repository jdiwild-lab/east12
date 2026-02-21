import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const FEET = 1;
const WALL_HEIGHT = 9 * FEET;
const WALL_THICKNESS = 0.3 * FEET;
const POSITION_SNAP = 0.25;
const ROTATION_STEP = Math.PI / 2;
const COLLISION_GAP = 0.2;

const DIM = {
  bedroomWidth: 10 + 7 / 12,
  bedroomDepth: 12 + 5 / 12,
  livingWidth: 13.5,
  kitchenReturn: 4 + 7 / 12,
  kitchenLeg: 8,
  denWidth: 9 + 7 / 12,
};

const CATALOG_ITEMS = [
  {
    id: "cat-sofa-1",
    name: "3-Seat Sofa",
    category: "Furniture",
    width: 7.2,
    depth: 3.1,
    height: 3,
    color: "#8f4a31",
    price: 899,
    image:
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=480&q=80",
    link: "https://www.ikea.com/",
  },
  {
    id: "cat-tv-1",
    name: "65in OLED TV",
    category: "Tech",
    width: 4.8,
    depth: 0.35,
    height: 2.8,
    color: "#1f2937",
    price: 1699,
    image:
      "https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=480&q=80",
    link: "https://www.bestbuy.com/",
  },
  {
    id: "cat-table-1",
    name: "Dining Table",
    category: "Furniture",
    width: 6,
    depth: 3.2,
    height: 2.5,
    color: "#7b5a3a",
    price: 650,
    image:
      "https://images.unsplash.com/photo-1577140917170-285929fb55b7?auto=format&fit=crop&w=480&q=80",
    link: "https://www.wayfair.com/",
  },
  {
    id: "cat-bed-1",
    name: "Queen Bed Frame",
    category: "Furniture",
    width: 5.2,
    depth: 6.8,
    height: 2,
    color: "#6d4c41",
    price: 799,
    image:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=480&q=80",
    link: "https://www.cb2.com/",
  },
  {
    id: "cat-desk-1",
    name: "Work Desk",
    category: "Furniture",
    width: 4.5,
    depth: 2.2,
    height: 2.5,
    color: "#4b5563",
    price: 420,
    image:
      "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=480&q=80",
    link: "https://www.hermanmiller.com/",
  },
  {
    id: "cat-speaker-1",
    name: "Bookshelf Speakers",
    category: "Tech",
    width: 1.2,
    depth: 1.2,
    height: 1.8,
    color: "#111827",
    price: 499,
    image:
      "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=480&q=80",
    link: "https://www.sonos.com/",
  },
];

const state = {
  furniture: load("apartmentPlannerFurniture", []),
  tracker: load("apartmentPlannerTracker", []),
  selectedId: null,
};

const viewer = document.getElementById("viewer");
const statusEl = document.getElementById("status");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewer.clientWidth, viewer.clientHeight);
renderer.shadowMap.enabled = true;
viewer.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#f4f5f7");

const camera = new THREE.PerspectiveCamera(55, viewer.clientWidth / viewer.clientHeight, 0.1, 2000);
camera.position.set(14, 28, 24);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const hemi = new THREE.HemisphereLight(0xffffff, 0x90a1af, 0.75);
scene.add(hemi);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
dirLight.position.set(22, 32, 16);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
scene.add(dirLight);

const apartmentGroup = new THREE.Group();
scene.add(apartmentGroup);

const furnitureGroup = new THREE.Group();
scene.add(furnitureGroup);

const floorPoints = buildMeasuredFloorPlan();
const floorShape = shapeFromPoints(floorPoints);
const floorMesh = new THREE.Mesh(
  new THREE.ShapeGeometry(floorShape),
  new THREE.MeshStandardMaterial({ color: "#e8e1d4", roughness: 0.95 })
);
floorMesh.rotation.x = -Math.PI / 2;
floorMesh.receiveShadow = true;
apartmentGroup.add(floorMesh);

const interiorWalls = buildInteriorWallSegments();
addPerimeterWalls(floorPoints);
addInteriorWalls(interiorWalls);

const grid = new THREE.GridHelper(90, 90, 0x9ca3af, 0xd1d5db);
grid.position.y = 0.01;
scene.add(grid);

const placementPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const drag = {
  active: false,
  item: null,
  offset: new THREE.Vector3(),
  lastValid: null,
};

const interiorWallColliders = interiorWalls.map((segment) => {
  const length = Math.hypot(segment.b.x - segment.a.x, segment.b.z - segment.a.z);
  const center = {
    x: (segment.a.x + segment.b.x) / 2,
    z: (segment.a.z + segment.b.z) / 2,
  };
  const angle = Math.atan2(segment.b.z - segment.a.z, segment.b.x - segment.a.x);
  return {
    center,
    width: length,
    depth: WALL_THICKNESS + COLLISION_GAP,
    angle,
  };
});

const extents = getExtents(floorPoints);
controls.target.set((extents.minX + extents.maxX) / 2, 0, (extents.minZ + extents.maxZ) / 2);

renderCatalog();
rebuildFurnitureMeshes();
renderTracker();

renderer.domElement.addEventListener("pointerdown", onPointerDown);
renderer.domElement.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerup", onPointerUp);
window.addEventListener("resize", onResize);
window.addEventListener("keydown", onKeyDown);
document.getElementById("furniture-form").addEventListener("submit", onAddFurniture);
document.getElementById("tracker-form").addEventListener("submit", onAddTrackerItem);

animate();

function buildMeasuredFloorPlan() {
  // Coordinates are in feet, derived from your measured sketch labels.
  const raw = [
    { x: 0, z: 0 },
    { x: DIM.bedroomWidth + DIM.livingWidth + DIM.kitchenReturn, z: 0 },
    { x: DIM.bedroomWidth + DIM.livingWidth + DIM.kitchenReturn, z: DIM.kitchenLeg },
    { x: DIM.bedroomWidth + DIM.livingWidth, z: DIM.kitchenLeg },
    { x: DIM.bedroomWidth + DIM.livingWidth, z: 20 },
    { x: DIM.bedroomWidth + DIM.livingWidth - DIM.denWidth, z: 20 },
    { x: DIM.bedroomWidth + DIM.livingWidth - DIM.denWidth, z: 16 },
    { x: 8, z: 16 },
    { x: 8, z: 20 },
    { x: 0, z: 20 },
    { x: 0, z: 20 - DIM.bedroomDepth },
    { x: DIM.bedroomWidth, z: 20 - DIM.bedroomDepth },
    { x: DIM.bedroomWidth, z: 0 },
  ];

  const ext = getExtents(raw);
  const cx = (ext.minX + ext.maxX) / 2;
  const cz = (ext.minZ + ext.maxZ) / 2;
  return raw.map((p) => ({ x: p.x - cx, z: p.z - cz }));
}

function buildInteriorWallSegments() {
  // Interior partitions approximating dividers/closets from your sketch.
  return [
    { a: pointByRaw(DIM.bedroomWidth, 0), b: pointByRaw(DIM.bedroomWidth, 16) },
    {
      a: pointByRaw(DIM.bedroomWidth, 16),
      b: pointByRaw(DIM.bedroomWidth + DIM.livingWidth - DIM.denWidth, 16),
    },
    {
      a: pointByRaw(DIM.bedroomWidth + DIM.livingWidth - DIM.denWidth, 16),
      b: pointByRaw(DIM.bedroomWidth + DIM.livingWidth - DIM.denWidth, 20),
    },
  ];

  function pointByRaw(x, z) {
    const ext = getExtents(
      [
        { x: 0, z: 0 },
        { x: DIM.bedroomWidth + DIM.livingWidth + DIM.kitchenReturn, z: 20 },
      ]
    );
    const cx = (ext.minX + ext.maxX) / 2;
    const cz = (ext.minZ + ext.maxZ) / 2;
    return { x: x - cx, z: z - cz };
  }
}

function shapeFromPoints(points) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].z);
  for (let i = 1; i < points.length; i += 1) {
    shape.lineTo(points[i].x, points[i].z);
  }
  shape.lineTo(points[0].x, points[0].z);
  return shape;
}

function addPerimeterWalls(points) {
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    addWallSegment(a, b, "#f8fafc");
  }
}

function addInteriorWalls(segments) {
  for (const segment of segments) {
    addWallSegment(segment.a, segment.b, "#ecf0f6");
  }
}

function addWallSegment(a, b, color) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dz);
  if (length < 0.05) return;

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(length, WALL_HEIGHT, WALL_THICKNESS),
    new THREE.MeshStandardMaterial({ color, roughness: 0.75 })
  );
  mesh.castShadow = true;
  mesh.position.set((a.x + b.x) / 2, WALL_HEIGHT / 2, (a.z + b.z) / 2);
  mesh.rotation.y = -Math.atan2(dz, dx);
  apartmentGroup.add(mesh);
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
    x: controls.target.x,
    z: controls.target.z,
    rotationY: 0,
  };

  if (!isValidPlacement(item, item.id)) {
    setStatus("Placement blocked: collides with a wall or another item.");
    return;
  }

  state.furniture.push(item);
  save("apartmentPlannerFurniture", state.furniture);
  rebuildFurnitureMeshes();
  setStatus(`Placed ${item.name}.`);

  event.target.reset();
  document.getElementById("item-width").value = 6;
  document.getElementById("item-depth").value = 3;
  document.getElementById("item-height").value = 3;
  document.getElementById("item-color").value = "#c46f37";
}

function rebuildFurnitureMeshes() {
  furnitureGroup.clear();

  for (const item of state.furniture) {
    const geom = new THREE.BoxGeometry(item.width, item.height, item.depth);
    const mat = new THREE.MeshStandardMaterial({
      color: item.color,
      emissive: item.id === state.selectedId ? new THREE.Color("#0f172a") : new THREE.Color("#000000"),
      emissiveIntensity: item.id === state.selectedId ? 0.18 : 0,
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(item.x, item.height / 2, item.z);
    mesh.rotation.y = item.rotationY;
    mesh.userData.itemId = item.id;

    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(geom),
      new THREE.LineBasicMaterial({ color: 0x1f2937 })
    );
    mesh.add(edge);

    furnitureGroup.add(mesh);
  }
}

function onPointerDown(event) {
  const hit = pickFurniture(event);
  if (!hit) {
    state.selectedId = null;
    rebuildFurnitureMeshes();
    return;
  }

  state.selectedId = hit.object.userData.itemId;
  rebuildFurnitureMeshes();

  const item = findFurniture(state.selectedId);
  if (!item) return;

  const hitPoint = getFloorIntersection(event);
  if (!hitPoint) return;

  drag.active = true;
  drag.item = item;
  drag.lastValid = { x: item.x, z: item.z };
  drag.offset.set(item.x - hitPoint.x, 0, item.z - hitPoint.z);
}

function onPointerMove(event) {
  if (!drag.active || !drag.item) return;
  const p = getFloorIntersection(event);
  if (!p) return;

  const candidate = {
    ...drag.item,
    x: snap(p.x + drag.offset.x, POSITION_SNAP),
    z: snap(p.z + drag.offset.z, POSITION_SNAP),
  };

  if (!isValidPlacement(candidate, drag.item.id)) {
    setStatus("Blocked: collision detected.");
    return;
  }

  drag.item.x = candidate.x;
  drag.item.z = candidate.z;
  drag.lastValid = { x: candidate.x, z: candidate.z };
  save("apartmentPlannerFurniture", state.furniture);
  rebuildFurnitureMeshes();
  setStatus("");
}

function onPointerUp() {
  drag.active = false;
  drag.item = null;
  drag.lastValid = null;
}

function onKeyDown(event) {
  if (!state.selectedId) return;
  const item = findFurniture(state.selectedId);
  if (!item) return;

  if (event.key.toLowerCase() === "r") {
    const candidate = { ...item, rotationY: item.rotationY + ROTATION_STEP };
    if (!isValidPlacement(candidate, item.id)) {
      setStatus("Rotate blocked: collision detected.");
      return;
    }
    item.rotationY = candidate.rotationY;
    save("apartmentPlannerFurniture", state.furniture);
    rebuildFurnitureMeshes();
    setStatus("");
  }

  if (event.key === "Delete" || event.key === "Backspace") {
    state.furniture = state.furniture.filter((f) => f.id !== state.selectedId);
    state.selectedId = null;
    save("apartmentPlannerFurniture", state.furniture);
    rebuildFurnitureMeshes();
    setStatus("Item removed.");
  }
}

function isValidPlacement(candidate, ignoreId) {
  const candidatePoly = getItemPolygon(candidate, COLLISION_GAP / 2);

  for (const corner of candidatePoly) {
    if (!pointInPolygon({ x: corner.x, z: corner.z }, floorPoints)) {
      return false;
    }
  }

  for (const wall of interiorWallColliders) {
    const wallPoly = getRectPolygon(wall.center.x, wall.center.z, wall.width, wall.depth, wall.angle);
    if (polygonsIntersect(candidatePoly, wallPoly)) {
      return false;
    }
  }

  for (const other of state.furniture) {
    if (other.id === ignoreId) continue;
    const otherPoly = getItemPolygon(other, COLLISION_GAP / 2);
    if (polygonsIntersect(candidatePoly, otherPoly)) {
      return false;
    }
  }

  return true;
}

function getItemPolygon(item, inflate = 0) {
  return getRectPolygon(item.x, item.z, item.width + inflate, item.depth + inflate, item.rotationY);
}

function getRectPolygon(cx, cz, width, depth, angle) {
  const hw = width / 2;
  const hd = depth / 2;
  const corners = [
    { x: -hw, z: -hd },
    { x: hw, z: -hd },
    { x: hw, z: hd },
    { x: -hw, z: hd },
  ];

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return corners.map((p) => ({
    x: cx + p.x * cos - p.z * sin,
    z: cz + p.x * sin + p.z * cos,
  }));
}

function polygonsIntersect(polyA, polyB) {
  const axes = [...getAxes(polyA), ...getAxes(polyB)];
  for (const axis of axes) {
    const a = project(polyA, axis);
    const b = project(polyB, axis);
    if (a.max < b.min || b.max < a.min) {
      return false;
    }
  }
  return true;
}

function getAxes(poly) {
  const axes = [];
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const edge = { x: b.x - a.x, z: b.z - a.z };
    const normal = { x: -edge.z, z: edge.x };
    const length = Math.hypot(normal.x, normal.z);
    if (length > 0) {
      axes.push({ x: normal.x / length, z: normal.z / length });
    }
  }
  return axes;
}

function project(poly, axis) {
  let min = Infinity;
  let max = -Infinity;
  for (const p of poly) {
    const value = p.x * axis.x + p.z * axis.z;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return { min, max };
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const zi = polygon[i].z;
    const xj = polygon[j].x;
    const zj = polygon[j].z;

    const intersect =
      zi > point.z !== zj > point.z &&
      point.x < ((xj - xi) * (point.z - zi)) / (zj - zi + Number.EPSILON) + xi;

    if (intersect) inside = !inside;
  }
  return inside;
}

function pickFurniture(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(furnitureGroup.children, true);
  return hits.find((h) => h.object.userData.itemId) || null;
}

function getFloorIntersection(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const p = new THREE.Vector3();
  const ok = raycaster.ray.intersectPlane(placementPlane, p);
  return ok ? p : null;
}

function onAddTrackerItem(event) {
  event.preventDefault();
  const item = {
    id: crypto.randomUUID(),
    name: document.getElementById("tracker-name").value.trim(),
    qty: Number(document.getElementById("tracker-qty").value),
    price: Number(document.getElementById("tracker-price").value),
    notes: document.getElementById("tracker-notes").value.trim(),
    status: "needed",
  };

  state.tracker.push(item);
  save("apartmentPlannerTracker", state.tracker);
  renderTracker();
  event.target.reset();
  document.getElementById("tracker-qty").value = 1;
  document.getElementById("tracker-price").value = 0;
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
        if (target) {
          target.status = target.status === "needed" ? "purchased" : "needed";
        }
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

  for (const item of CATALOG_ITEMS) {
    const card = document.createElement("article");
    card.className = "catalog-item";
    card.innerHTML = `
      <img src="${item.image}" alt="${escapeHtml(item.name)}" loading="lazy" />
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <small>${item.category} • ${item.width.toFixed(1)}' x ${item.depth.toFixed(1)}' • $${item.price}</small>
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
      const id = button.dataset.id;
      const item = CATALOG_ITEMS.find((entry) => entry.id === id);
      if (!item) return;

      if (button.dataset.action === "place") {
        const placed = {
          id: crypto.randomUUID(),
          name: item.name,
          width: item.width,
          depth: item.depth,
          height: item.height,
          color: item.color,
          x: controls.target.x,
          z: controls.target.z,
          rotationY: 0,
        };

        if (!isValidPlacement(placed, placed.id)) {
          setStatus("Catalog item cannot be placed at center. Move camera and try manual placement.");
          return;
        }

        state.furniture.push(placed);
        save("apartmentPlannerFurniture", state.furniture);
        rebuildFurnitureMeshes();
        setStatus(`Placed ${item.name} from catalog.`);
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
        setStatus(`Added ${item.name} to tracker.`);
      }
    });
  });
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = viewer.clientWidth / viewer.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(viewer.clientWidth, viewer.clientHeight);
}

function findFurniture(id) {
  return state.furniture.find((f) => f.id === id) || null;
}

function setStatus(text) {
  statusEl.textContent = text;
}

function snap(value, step) {
  return Math.round(value / step) * step;
}

function getExtents(points) {
  return points.reduce(
    (acc, p) => ({
      minX: Math.min(acc.minX, p.x),
      maxX: Math.max(acc.maxX, p.x),
      minZ: Math.min(acc.minZ, p.z),
      maxZ: Math.max(acc.maxZ, p.z),
    }),
    { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }
  );
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
