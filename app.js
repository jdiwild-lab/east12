import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const CEILING_HEIGHT = 9.5;
const WALL_THICKNESS = 0.35;
const POSITION_SNAP = 0.25;
const ROTATION_STEP = Math.PI / 2;
const COLLISION_GAP = 0.2;

const DIM = {
  bedroomWidth: 15 + 10 / 12,
  bedroomDepth: 16,
  livingWidth: 19 + 11 / 12,
  livingDepth: 17 + 4 / 12,
  kitchenWidth: 7,
  kitchenRise: 6,
  foyerDepth: 28,
};

const FEATURE_RAW = {
  windows: [
    { x: 0, z: 4, len: 2.4, axis: "z" },
    { x: 0, z: 8.7, len: 2.2, axis: "z" },
    { x: 0, z: 20.8, len: 2.2, axis: "z" },
    { x: 12.5, z: 0, len: 2.4, axis: "x" },
    { x: 22.5, z: 0, len: 2.4, axis: "x" },
    { x: 30.5, z: 0, len: 2.2, axis: "x" },
    { x: 34.75, z: -3.2, len: 2.2, axis: "z" },
  ],
  doors: [
    { x: 15.9, z: 15.3, r: 1.35, startDeg: 180, endDeg: 270 },
    { x: 9.6, z: 24, r: 1.2, startDeg: 0, endDeg: 90 },
    { x: 30.3, z: 28, r: 1.2, startDeg: 180, endDeg: 270 },
    { x: 31.75, z: 17.4, r: 1.05, startDeg: 180, endDeg: 270 },
    { x: 31.75, z: 20.7, r: 1.05, startDeg: 180, endDeg: 270 },
    { x: 31.75, z: 24.2, r: 1.05, startDeg: 180, endDeg: 270 },
    { x: 14.9, z: 4.8, r: 1.1, startDeg: -90, endDeg: 0 },
  ],
  closets: [
    { label: "CLOSET", x: 13.9, z: 5.5, w: 2.1, d: 5.4 },
    { label: "CLOSET", x: 21.0, z: 24.0, w: 4.2, d: 1.8 },
    { label: "CLOSET", x: 31.0, z: 17.4, w: 1.8, d: 1.6 },
    { label: "CLOSET", x: 31.0, z: 20.7, w: 1.8, d: 2.2 },
    { label: "CLOSET", x: 31.0, z: 24.2, w: 1.8, d: 2.2 },
  ],
  fixedLabels: [
    { label: "W/D", x: 12.7, z: 20.0 },
    { label: "DW", x: 39.6, z: 3.0 },
    { label: "REF", x: 39.4, z: 5.4 },
    { label: "WINE REF", x: 39.2, z: 8.2 },
  ],
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
  furniture: loadFurniture(),
  tracker: load("apartmentPlannerTracker", []),
  catalog: loadCatalog(),
  selectedId: null,
};

const viewer = document.getElementById("viewer");
const statusEl = document.getElementById("status");

const scene = new THREE.Scene();
scene.background = new THREE.Color("#f4f7fb");

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewer.clientWidth, viewer.clientHeight);
renderer.shadowMap.enabled = true;
viewer.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(55, viewer.clientWidth / viewer.clientHeight, 0.1, 1000);
camera.position.set(22, 30, 28);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xffffff, 0x8ea2b5, 0.75));
const sun = new THREE.DirectionalLight(0xffffff, 0.85);
sun.position.set(20, 35, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const apartmentGroup = new THREE.Group();
const furnitureGroup = new THREE.Group();
scene.add(apartmentGroup);
scene.add(furnitureGroup);

const floorPoints = buildFloorPoints();
const floorShape = shapeFromPoints(floorPoints);
const floorMesh = new THREE.Mesh(
  new THREE.ShapeGeometry(floorShape),
  new THREE.MeshStandardMaterial({ color: "#e8e0d2", roughness: 0.95 })
);
floorMesh.rotation.x = -Math.PI / 2;
floorMesh.receiveShadow = true;
apartmentGroup.add(floorMesh);

addPerimeterWalls(floorPoints);
const interiorWalls = buildInteriorWallSegments();
addInteriorWalls(interiorWalls);

addRoomLabel("BEDROOM", rawToCentered(7, 8));
addRoomLabel("LIVING ROOM", rawToCentered(25, 9));
addRoomLabel("KITCHEN", rawToCentered(39, 5));
addRoomLabel("BATH", rawToCentered(5, 22));
addRoomLabel("FOYER", rawToCentered(30, 22));
addArchitecturalFeatures();

const grid = new THREE.GridHelper(90, 90, 0xa8b1bc, 0xd5dce5);
grid.position.y = 0.01;
scene.add(grid);

const ext = getExtents(floorPoints);
controls.target.set((ext.minX + ext.maxX) / 2, 0, (ext.minZ + ext.maxZ) / 2);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const drag = { active: false, item: null, offset: new THREE.Vector3() };
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

const wallColliders = interiorWalls.map((segment) => {
  const length = Math.hypot(segment.b.x - segment.a.x, segment.b.z - segment.a.z);
  return {
    cx: (segment.a.x + segment.b.x) / 2,
    cz: (segment.a.z + segment.b.z) / 2,
    width: length,
    depth: WALL_THICKNESS + COLLISION_GAP,
    angle: Math.atan2(segment.b.z - segment.a.z, segment.b.x - segment.a.x),
  };
});

rebuildFurnitureMeshes();
renderCatalog();
renderTracker();

renderer.domElement.addEventListener("pointerdown", onPointerDown);
renderer.domElement.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerup", onPointerUp);
window.addEventListener("keydown", onKeyDown);
window.addEventListener("resize", onResize);

// Sidebar forms

document.getElementById("furniture-form").addEventListener("submit", onAddFurniture);
document.getElementById("link-form").addEventListener("submit", onAddFromLink);
document.getElementById("tracker-form").addEventListener("submit", onAddTrackerItem);
document.getElementById("catalog-import-form").addEventListener("submit", onCatalogImport);
document.getElementById("catalog-reset-btn").addEventListener("click", onCatalogReset);

animate();

function buildFloorPoints() {
  const raw = getRawFloorOutline();
  const e = getExtents(raw);
  const cx = (e.minX + e.maxX) / 2;
  const cz = (e.minZ + e.maxZ) / 2;
  return raw.map((p) => ({ x: p.x - cx, z: p.z - cz }));
}

function getRawFloorOutline() {
  return [
    { x: 0, z: 0 },
    { x: DIM.bedroomWidth + DIM.livingWidth, z: 0 },
    { x: DIM.bedroomWidth + DIM.livingWidth, z: -DIM.kitchenRise },
    { x: DIM.bedroomWidth + DIM.livingWidth + DIM.kitchenWidth, z: -DIM.kitchenRise },
    { x: DIM.bedroomWidth + DIM.livingWidth + DIM.kitchenWidth, z: DIM.livingDepth },
    { x: DIM.bedroomWidth + DIM.livingWidth, z: DIM.livingDepth },
    { x: DIM.bedroomWidth + DIM.livingWidth, z: DIM.foyerDepth },
    { x: 26, z: DIM.foyerDepth },
    { x: 26, z: 24 },
    { x: 16, z: 24 },
    { x: 16, z: DIM.foyerDepth },
    { x: 0, z: DIM.foyerDepth },
  ];
}

function buildInteriorWallSegments() {
  const xSplit = DIM.bedroomWidth;
  return [
    { a: rawToCentered(xSplit, 0), b: rawToCentered(xSplit, DIM.bedroomDepth) },
    { a: rawToCentered(18, 24), b: rawToCentered(26, 24) },
    { a: rawToCentered(DIM.bedroomWidth + DIM.livingWidth, DIM.livingDepth), b: rawToCentered(DIM.bedroomWidth + DIM.livingWidth, DIM.foyerDepth) },
  ];
}

function rawToCentered(x, z) {
  const pts = getRawFloorOutline();
  const e = getExtents(pts);
  const cx = (e.minX + e.maxX) / 2;
  const cz = (e.minZ + e.maxZ) / 2;
  return { x: x - cx, z: z - cz };
}

function shapeFromPoints(points) {
  const s = new THREE.Shape();
  s.moveTo(points[0].x, points[0].z);
  for (let i = 1; i < points.length; i += 1) s.lineTo(points[i].x, points[i].z);
  s.lineTo(points[0].x, points[0].z);
  return s;
}

function addPerimeterWalls(points) {
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    addWallSegment(a, b, "#f8fafc");
  }
}

function addInteriorWalls(segments) {
  for (const seg of segments) addWallSegment(seg.a, seg.b, "#e6edf6");
}

function addWallSegment(a, b, color) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dz);
  if (length < 0.05) return;

  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(length, CEILING_HEIGHT, WALL_THICKNESS),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
  );
  wall.castShadow = true;
  wall.position.set((a.x + b.x) / 2, CEILING_HEIGHT / 2, (a.z + b.z) / 2);
  wall.rotation.y = -Math.atan2(dz, dx);
  apartmentGroup.add(wall);
}

function addRoomLabel(text, pos) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#1f2937";
  ctx.font = "700 52px 'Source Sans 3'";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 64);

  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(6, 1.5, 1);
  sprite.position.set(pos.x, 4.8, pos.z);
  apartmentGroup.add(sprite);
}

function addArchitecturalFeatures() {
  addWindowMarkers();
  addDoorSwings();
  addClosetZones();
  addFixedLabels();
}

function addWindowMarkers() {
  for (const w of FEATURE_RAW.windows) {
    const p = rawToCentered(w.x, w.z);
    const geom = new THREE.PlaneGeometry(w.axis === "x" ? w.len : 0.16, w.axis === "z" ? w.len : 0.16);
    const mat = new THREE.MeshStandardMaterial({
      color: "#9adff5",
      transparent: true,
      opacity: 0.7,
      emissive: "#7dd3fc",
      emissiveIntensity: 0.22,
      side: THREE.DoubleSide,
    });
    const pane = new THREE.Mesh(geom, mat);
    pane.position.set(p.x, CEILING_HEIGHT * 0.6, p.z);
    pane.rotation.x = -Math.PI / 2;
    apartmentGroup.add(pane);
  }
}

function addDoorSwings() {
  for (const d of FEATURE_RAW.doors) {
    const center = rawToCentered(d.x, d.z);
    const points = [];
    const start = (d.startDeg * Math.PI) / 180;
    const end = (d.endDeg * Math.PI) / 180;
    const steps = 24;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const a = start + (end - start) * t;
      points.push(new THREE.Vector3(center.x + d.r * Math.cos(a), 0.06, center.z + d.r * Math.sin(a)));
    }

    const arc = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: 0x64748b })
    );
    apartmentGroup.add(arc);

    const leaf = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(center.x, 0.06, center.z),
        points[points.length - 1],
      ]),
      new THREE.LineBasicMaterial({ color: 0x94a3b8 })
    );
    apartmentGroup.add(leaf);
  }
}

function addClosetZones() {
  for (const c of FEATURE_RAW.closets) {
    const p = rawToCentered(c.x, c.z);
    const outline = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(p.x - c.w / 2, 0.04, p.z - c.d / 2),
        new THREE.Vector3(p.x + c.w / 2, 0.04, p.z - c.d / 2),
        new THREE.Vector3(p.x + c.w / 2, 0.04, p.z + c.d / 2),
        new THREE.Vector3(p.x - c.w / 2, 0.04, p.z + c.d / 2),
      ]),
      new THREE.LineBasicMaterial({ color: 0x1d4ed8 })
    );
    apartmentGroup.add(outline);
    addSmallLabel(c.label, p.x, p.z, 0.7);
  }
}

function addFixedLabels() {
  for (const entry of FEATURE_RAW.fixedLabels) {
    const p = rawToCentered(entry.x, entry.z);
    addSmallLabel(entry.label, p.x, p.z, 0.65);
  }
}

function addSmallLabel(text, x, z, scaleY = 0.7) {
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0f172a";
  ctx.font = "700 38px 'Source Sans 3'";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false })
  );
  sprite.scale.set(3.8, scaleY, 1);
  sprite.position.set(x, 0.38, z);
  apartmentGroup.add(sprite);
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
    setStatus("Placement blocked: collides with wall/furniture.");
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

function onAddFromLink(event) {
  event.preventDefault();
  const input = document.getElementById("item-link");
  const raw = input.value.trim();
  if (!raw) {
    setStatus("Paste a product link first.");
    return;
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    setStatus("Invalid URL.");
    return;
  }

  const preset = inferPresetFromLink(url.href);
  const item = {
    id: crypto.randomUUID(),
    name: deriveNameFromUrl(url),
    width: preset.width,
    depth: preset.depth,
    height: preset.height,
    color: preset.color,
    x: controls.target.x,
    z: controls.target.z,
    rotationY: 0,
  };

  if (!isValidPlacement(item, item.id)) {
    setStatus("Auto-placement blocked at center.");
    return;
  }

  state.furniture.push(item);
  save("apartmentPlannerFurniture", state.furniture);
  rebuildFurnitureMeshes();

  state.tracker.push({
    id: crypto.randomUUID(),
    name: item.name,
    qty: 1,
    price: 0,
    notes: url.href,
    status: "needed",
  });
  save("apartmentPlannerTracker", state.tracker);
  renderTracker();

  input.value = "";
  setStatus(`Added ${item.name} from link.`);
}

function rebuildFurnitureMeshes() {
  furnitureGroup.clear();
  for (const item of state.furniture) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(item.width, item.height, item.depth),
      new THREE.MeshStandardMaterial({
        color: item.color,
        emissive: item.id === state.selectedId ? new THREE.Color("#0f172a") : new THREE.Color("#000000"),
        emissiveIntensity: item.id === state.selectedId ? 0.2 : 0,
      })
    );

    mesh.position.set(item.x, item.height / 2, item.z);
    mesh.rotation.y = item.rotationY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.itemId = item.id;

    mesh.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry),
      new THREE.LineBasicMaterial({ color: 0x1f2937 })
    ));

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

  const p = floorIntersection(event);
  if (!p) return;

  drag.active = true;
  drag.item = item;
  drag.offset.set(item.x - p.x, 0, item.z - p.z);
}

function onPointerMove(event) {
  if (!drag.active || !drag.item) return;
  const p = floorIntersection(event);
  if (!p) return;

  const candidate = {
    ...drag.item,
    x: snap(p.x + drag.offset.x, POSITION_SNAP),
    z: snap(p.z + drag.offset.z, POSITION_SNAP),
  };

  if (!isValidPlacement(candidate, drag.item.id)) return;

  drag.item.x = candidate.x;
  drag.item.z = candidate.z;
  save("apartmentPlannerFurniture", state.furniture);
  rebuildFurnitureMeshes();
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
    const candidate = { ...item, rotationY: item.rotationY + ROTATION_STEP };
    if (!isValidPlacement(candidate, item.id)) {
      setStatus("Rotate blocked by collision.");
      return;
    }
    item.rotationY = candidate.rotationY;
    save("apartmentPlannerFurniture", state.furniture);
    rebuildFurnitureMeshes();
  }

  if (event.key === "Delete" || event.key === "Backspace") {
    state.furniture = state.furniture.filter((f) => f.id !== state.selectedId);
    state.selectedId = null;
    save("apartmentPlannerFurniture", state.furniture);
    rebuildFurnitureMeshes();
  }
}

function pickFurniture(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(furnitureGroup.children, true);
  return hits.find((h) => h.object.userData.itemId) || null;
}

function floorIntersection(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const p = new THREE.Vector3();
  return raycaster.ray.intersectPlane(groundPlane, p) ? p : null;
}

function isValidPlacement(candidate, ignoreId) {
  const poly = getItemPolygon(candidate, COLLISION_GAP / 2);

  for (const c of poly) {
    if (!pointInPolygon(c, floorPoints)) return false;
  }

  for (const wall of wallColliders) {
    const wallPoly = getRectPolygon(wall.cx, wall.cz, wall.width, wall.depth, wall.angle);
    if (polygonsIntersect(poly, wallPoly)) return false;
  }

  for (const other of state.furniture) {
    if (other.id === ignoreId) continue;
    const otherPoly = getItemPolygon(other, COLLISION_GAP / 2);
    if (polygonsIntersect(poly, otherPoly)) return false;
  }

  return true;
}

function getItemPolygon(item, inflate) {
  return getRectPolygon(item.x, item.z, item.width + inflate, item.depth + inflate, item.rotationY);
}

function getRectPolygon(cx, cz, width, depth, angle) {
  const hw = width / 2;
  const hd = depth / 2;
  const pts = [
    { x: -hw, z: -hd },
    { x: hw, z: -hd },
    { x: hw, z: hd },
    { x: -hw, z: hd },
  ];

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return pts.map((p) => ({ x: cx + p.x * cos - p.z * sin, z: cz + p.x * sin + p.z * cos }));
}

function polygonsIntersect(a, b) {
  const axes = [...axesFor(a), ...axesFor(b)];
  for (const axis of axes) {
    const pa = project(a, axis);
    const pb = project(b, axis);
    if (pa.max < pb.min || pb.max < pa.min) return false;
  }
  return true;
}

function axesFor(poly) {
  const axes = [];
  for (let i = 0; i < poly.length; i += 1) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % poly.length];
    const edge = { x: p2.x - p1.x, z: p2.z - p1.z };
    const n = { x: -edge.z, z: edge.x };
    const len = Math.hypot(n.x, n.z);
    if (len > 0) axes.push({ x: n.x / len, z: n.z / len });
  }
  return axes;
}

function project(poly, axis) {
  let min = Infinity;
  let max = -Infinity;
  for (const p of poly) {
    const v = p.x * axis.x + p.z * axis.z;
    min = Math.min(min, v);
    max = Math.max(max, v);
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
    const cross = zi > point.z !== zj > point.z && point.x < ((xj - xi) * (point.z - zi)) / (zj - zi + Number.EPSILON) + xi;
    if (cross) inside = !inside;
  }
  return inside;
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

function renderTracker() {
  const list = document.getElementById("tracker-list");
  list.innerHTML = "";

  for (const item of state.tracker) {
    const row = document.createElement("div");
    row.className = `tracker-item${item.status === "purchased" ? " purchased" : ""}`;
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

    list.appendChild(row);
  }

  list.querySelectorAll("button").forEach((button) => {
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

  const purchased = state.tracker.filter((t) => t.status === "purchased");
  const needed = state.tracker.filter((t) => t.status === "needed");
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
      const item = state.catalog.find((c) => c.id === button.dataset.id);
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
          setStatus("Catalog item placement blocked.");
          return;
        }
        state.furniture.push(placed);
        save("apartmentPlannerFurniture", state.furniture);
        rebuildFurnitureMeshes();
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
  if (!text) return;

  const parsed = parseCatalogText(text);
  if (!parsed.length) {
    setStatus("No valid rows imported.");
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
  setStatus(`Catalog import complete: ${added} item(s).`);
}

function onCatalogReset() {
  state.catalog = DEFAULT_CATALOG_ITEMS.map((item) => ({ ...item }));
  save("apartmentPlannerCatalog", state.catalog);
  renderCatalog();
}

function parseCatalogText(text) {
  if (text.startsWith("[") || text.startsWith("{")) {
    try {
      const data = JSON.parse(text);
      const list = Array.isArray(data) ? data : [data];
      return list.map(normalizeCatalogItem).filter(Boolean);
    } catch {
      return [];
    }
  }

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];

  const headers = parseCSVLine(lines[0]).map((v) => v.toLowerCase());
  const items = [];
  for (const line of lines.slice(1)) {
    const cols = parseCSVLine(line);
    const row = {};
    for (let i = 0; i < headers.length; i += 1) row[headers[i]] = cols[i] ?? "";
    const item = normalizeCatalogItem(row);
    if (item) items.push(item);
  }
  return items;
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
  const width = Number(row.width);
  const depth = Number(row.depth);
  const height = Number(row.height);
  if (!name || !(width > 0) || !(depth > 0) || !(height > 0)) return null;

  const colorRaw = String(row.color ?? "#7b5a3a").trim();
  return {
    id: crypto.randomUUID(),
    name,
    category: String(row.category ?? "Furniture").trim() || "Furniture",
    width,
    depth,
    height,
    color: validHex(colorRaw) ? colorRaw : "#7b5a3a",
    price: Math.max(0, Number(row.price) || 0),
    link: String(row.link ?? "https://www.google.com/search?q=furniture").trim() || "https://www.google.com/search?q=furniture",
    image: String(row.image ?? "").trim() || "https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=480&q=80",
  };
}

function inferPresetFromLink(link) {
  const s = link.toLowerCase();
  if (s.includes("sofa") || s.includes("couch") || s.includes("sectional")) return { width: 7.5, depth: 3.2, height: 3, color: "#8f4a31" };
  if (s.includes("bed") || s.includes("mattress")) return { width: 5.2, depth: 6.8, height: 2, color: "#6d4c41" };
  if (s.includes("tv") || s.includes("monitor")) return { width: 4.8, depth: 0.4, height: 2.8, color: "#1f2937" };
  if (s.includes("desk") || s.includes("table")) return { width: 4.8, depth: 2.4, height: 2.5, color: "#7b5a3a" };
  if (s.includes("chair")) return { width: 2, depth: 2, height: 3, color: "#4b5563" };
  return { width: 3, depth: 2, height: 3, color: "#7b5a3a" };
}

function deriveNameFromUrl(url) {
  const leaf = url.pathname.split("/").filter(Boolean).pop();
  if (!leaf) return `${url.hostname.replace("www.", "")} item`;

  const cleaned = decodeURIComponent(leaf)
    .replaceAll(/[-_]+/g, " ")
    .replaceAll(/[0-9]+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();

  if (!cleaned) return `${url.hostname.replace("www.", "")} item`;
  return cleaned
    .split(" ")
    .slice(0, 6)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function onResize() {
  camera.aspect = viewer.clientWidth / viewer.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(viewer.clientWidth, viewer.clientHeight);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function loadFurniture() {
  const data = load("apartmentPlannerFurniture", []);
  return data
    .map((item) => ({
      ...item,
      z: Number.isFinite(item.z) ? item.z : Number.isFinite(item.y) ? item.y : 0,
      rotationY: Number.isFinite(item.rotationY)
        ? item.rotationY
        : Number.isFinite(item.rotation)
          ? (item.rotation * Math.PI) / 180
          : 0,
    }))
    .filter((item) => item.width > 0 && item.depth > 0 && item.height > 0);
}

function findFurniture(id) {
  return state.furniture.find((f) => f.id === id) || null;
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

function loadCatalog() {
  const stored = load("apartmentPlannerCatalog", []);
  if (Array.isArray(stored) && stored.length) return stored.map(normalizeCatalogItem).filter(Boolean);
  return DEFAULT_CATALOG_ITEMS.map((item) => ({ ...item }));
}

function normalizeKey(name, link) {
  return `${String(name).trim().toLowerCase()}|${String(link).trim().toLowerCase()}`;
}

function setStatus(text) {
  statusEl.textContent = text;
}

function snap(value, step) {
  return Math.round(value / step) * step;
}

function validHex(value) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
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
