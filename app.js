import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const CEILING_HEIGHT = 9.5;
const EXTERIOR_WALL_THICKNESS = 8 / 12;
const INTERIOR_WALL_THICKNESS = 4.5 / 12;
const POSITION_SNAP = 0.25;
const ROTATION_STEP = Math.PI / 2;
const COLLISION_GAP = 0.2;

const ROOM = {
  BEDROOM: { width: 15.83, depth: 16.0 },
  LIVING: { width: 19.92, depth: 17.33 },
  KITCHEN: { width: 8.0, depth: 14.0 },
  BATH: { width: 8.0, depth: 6.0 },
};

const DOOR = {
  ENTRY: 3.0,
  INTERIOR: 2.5,
  CLOSET: 2.0,
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
    name: "Queen Bed Frame",
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

const RAW = buildRawGeometry();

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

const camera = new THREE.PerspectiveCamera(55, viewer.clientWidth / viewer.clientHeight, 0.1, 1500);
camera.position.set(24, 34, 28);

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

const floorShape = shapeFromPoints(RAW.floor);
const floorMesh = new THREE.Mesh(
  new THREE.ShapeGeometry(floorShape),
  new THREE.MeshStandardMaterial({ color: "#e8e0d2", roughness: 0.95 })
);
floorMesh.rotation.x = -Math.PI / 2;
floorMesh.receiveShadow = true;
apartmentGroup.add(floorMesh);

addWallSegments(RAW.perimeterWalls, EXTERIOR_WALL_THICKNESS, "#f8fafc");
addWallSegments(RAW.interiorWalls, INTERIOR_WALL_THICKNESS, "#e6edf6");
addRoomLabels();
addWindowMarkers();
addDoorSwings();
addDoorWidthLabels();

const grid = new THREE.GridHelper(100, 100, 0xa8b1bc, 0xd5dce5);
grid.position.y = 0.01;
scene.add(grid);

const ext = getExtents(RAW.floor);
controls.target.set((ext.minX + ext.maxX) / 2, 0, (ext.minZ + ext.maxZ) / 2);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const drag = { active: false, item: null, offset: new THREE.Vector3() };
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

const wallColliders = RAW.interiorWalls.map((segment) => {
  const length = Math.hypot(segment.b.x - segment.a.x, segment.b.z - segment.a.z);
  return {
    cx: (segment.a.x + segment.b.x) / 2,
    cz: (segment.a.z + segment.b.z) / 2,
    width: length,
    depth: INTERIOR_WALL_THICKNESS + COLLISION_GAP,
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

document.getElementById("furniture-form").addEventListener("submit", onAddFurniture);
document.getElementById("link-form").addEventListener("submit", onAddFromLink);
document.getElementById("tracker-form").addEventListener("submit", onAddTrackerItem);
document.getElementById("catalog-import-form").addEventListener("submit", onCatalogImport);
document.getElementById("catalog-reset-btn").addEventListener("click", onCatalogReset);

animate();

function buildRawGeometry() {
  const x0 = 0;
  const x1 = ROOM.BEDROOM.width;
  const x2 = x1 + ROOM.LIVING.width;
  const x3 = x2 + ROOM.KITCHEN.width;

  const zTop = 0;
  const zKitchenBottom = ROOM.KITCHEN.depth;
  const zBedroomBottom = ROOM.BEDROOM.depth;
  const zLivingBottom = ROOM.LIVING.depth;
  const zBathBottom = zBedroomBottom + ROOM.BATH.depth;
  const zFoyerBottom = 26;

  const floorRaw = [
    { x: x0, z: zTop },
    { x: x3, z: zTop },
    { x: x3, z: zKitchenBottom },
    { x: x2, z: zKitchenBottom },
    { x: x2, z: zFoyerBottom },
    { x: 20, z: zFoyerBottom },
    { x: 20, z: zBathBottom },
    { x: x0, z: zBathBottom },
  ];

  const interiorRaw = [
    // Bedroom/Living divider.
    { a: { x: x1, z: zTop }, b: { x: x1, z: zBedroomBottom } },
    // Living/Foyer divider.
    { a: { x: 20, z: zLivingBottom }, b: { x: 20, z: zFoyerBottom } },
    // Bath/Foyer divider top.
    { a: { x: 8, z: zBedroomBottom }, b: { x: 20, z: zBedroomBottom } },
    // Kitchen/Living divider.
    { a: { x: x2, z: zKitchenBottom }, b: { x: x2, z: zLivingBottom } },
  ];

  const centeredFloor = centerPoints(floorRaw);
  const center = getCenter(floorRaw);

  const centeredInterior = interiorRaw.map((s) => ({
    a: { x: s.a.x - center.x, z: s.a.z - center.z },
    b: { x: s.b.x - center.x, z: s.b.z - center.z },
  }));

  const perimeter = [];
  for (let i = 0; i < centeredFloor.length; i += 1) {
    perimeter.push({ a: centeredFloor[i], b: centeredFloor[(i + 1) % centeredFloor.length] });
  }

  return {
    center,
    floor: centeredFloor,
    perimeterWalls: perimeter,
    interiorWalls: centeredInterior,
    rooms: {
      bedroom: toCenteredPoint(ROOM.BEDROOM.width * 0.5, ROOM.BEDROOM.depth * 0.52, center),
      living: toCenteredPoint(x1 + ROOM.LIVING.width * 0.5, ROOM.LIVING.depth * 0.5, center),
      kitchen: toCenteredPoint(x2 + ROOM.KITCHEN.width * 0.5, ROOM.KITCHEN.depth * 0.5, center),
      bath: toCenteredPoint(ROOM.BATH.width * 0.5, zBedroomBottom + ROOM.BATH.depth * 0.5, center),
      foyer: toCenteredPoint(x1 + ROOM.LIVING.width * 0.6, 22, center),
    },
    windows: [
      // Bedroom left wall: 1 @ 3 ft
      wallWindows({ x: x0, z1: 2.5, z2: 13.5, count: 1, length: 3, axis: "z", center }),
      // Bedroom top wall: 2 @ 3.5 ft
      wallWindows({ x1: 2, x2: x1 - 2, z: zTop, count: 2, length: 3.5, axis: "x", center }),
      // Living top wall: 3 @ 3.5 ft
      wallWindows({ x1: x1 + 1.5, x2: x2 - 1.5, z: zTop, count: 3, length: 3.5, axis: "x", center }),
      // Kitchen top wall: 1 @ 3 ft
      wallWindows({ x1: x2 + 1.2, x2: x3 - 1.2, z: zTop, count: 1, length: 3, axis: "x", center }),
      // Bathroom left wall: 1 @ 2.5 ft
      wallWindows({ x: x0, z1: zBedroomBottom + 1, z2: zBathBottom - 1, count: 1, length: 2.5, axis: "z", center }),
    ].flat(),
    doorSwings: [
      // Entry door
      swing(26, zFoyerBottom, DOOR.ENTRY / 2, 180, 270, center),
      // Interior door bedroom->living
      swing(x1, 14.4, DOOR.INTERIOR / 2, 180, 270, center),
      // Interior bath door
      swing(8, zBedroomBottom, DOOR.INTERIOR / 2, 0, 90, center),
      // Closet doors (approximate)
      swing(x1 - 0.2, 5.6, DOOR.CLOSET / 2, -90, 0, center),
      swing(x2 + 0.1, 19.5, DOOR.CLOSET / 2, 180, 270, center),
      swing(x2 + 0.1, 22.4, DOOR.CLOSET / 2, 180, 270, center),
      swing(x2 + 0.1, 25.2, DOOR.CLOSET / 2, 180, 270, center),
    ],
  };
}

function wallWindows({ x, x1, x2, z, z1, z2, count, length, axis, center }) {
  const windows = [];
  if (axis === "x") {
    const span = x2 - x1;
    const gap = span / (count + 1);
    for (let i = 1; i <= count; i += 1) {
      windows.push({ x: x1 + gap * i - center.x, z: z - center.z, len: length, axis: "x" });
    }
  } else {
    const span = z2 - z1;
    const gap = span / (count + 1);
    for (let i = 1; i <= count; i += 1) {
      windows.push({ x: x - center.x, z: z1 + gap * i - center.z, len: length, axis: "z" });
    }
  }
  return windows;
}

function swing(x, z, r, startDeg, endDeg, center) {
  return { x: x - center.x, z: z - center.z, r, startDeg, endDeg };
}

function addWallSegments(segments, thickness, color) {
  for (const segment of segments) {
    const dx = segment.b.x - segment.a.x;
    const dz = segment.b.z - segment.a.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.05) continue;

    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(length, CEILING_HEIGHT, thickness),
      new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
    );
    wall.castShadow = true;
    wall.position.set((segment.a.x + segment.b.x) / 2, CEILING_HEIGHT / 2, (segment.a.z + segment.b.z) / 2);
    wall.rotation.y = -Math.atan2(dz, dx);
    apartmentGroup.add(wall);
  }
}

function addRoomLabels() {
  addLabel("BEDROOM", RAW.rooms.bedroom, 6.4, 1.5, 4.8);
  addLabel("LIVING ROOM", RAW.rooms.living, 7.5, 1.5, 4.8);
  addLabel("KITCHEN", RAW.rooms.kitchen, 5.2, 1.4, 4.8);
  addLabel("BATH", RAW.rooms.bath, 3.8, 1.2, 4.8);
  addLabel("FOYER", RAW.rooms.foyer, 3.8, 1.2, 4.8);
}

function addWindowMarkers() {
  for (const w of RAW.windows) {
    const geom = new THREE.PlaneGeometry(w.axis === "x" ? w.len : 0.18, w.axis === "z" ? w.len : 0.18);
    const pane = new THREE.Mesh(
      geom,
      new THREE.MeshStandardMaterial({
        color: "#8ee1f5",
        transparent: true,
        opacity: 0.72,
        emissive: "#7dd3fc",
        emissiveIntensity: 0.25,
        side: THREE.DoubleSide,
      })
    );
    pane.position.set(w.x, CEILING_HEIGHT * 0.62, w.z);
    pane.rotation.x = -Math.PI / 2;
    apartmentGroup.add(pane);
  }
}

function addDoorSwings() {
  for (const d of RAW.doorSwings) {
    const start = (d.startDeg * Math.PI) / 180;
    const end = (d.endDeg * Math.PI) / 180;
    const points = [];
    for (let i = 0; i <= 22; i += 1) {
      const t = i / 22;
      const a = start + (end - start) * t;
      points.push(new THREE.Vector3(d.x + d.r * Math.cos(a), 0.06, d.z + d.r * Math.sin(a)));
    }

    apartmentGroup.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: 0x64748b })
      )
    );

    apartmentGroup.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(d.x, 0.06, d.z),
          points[points.length - 1],
        ]),
        new THREE.LineBasicMaterial({ color: 0x94a3b8 })
      )
    );
  }
}

function addDoorWidthLabels() {
  addLabel(`ENTRY ${DOOR.ENTRY.toFixed(1)}'`, rawToCentered(26, 25.2), 2.8, 0.7, 0.55);
  addLabel(`INT ${DOOR.INTERIOR.toFixed(1)}'`, rawToCentered(15.6, 14.1), 2.7, 0.7, 0.55);
  addLabel(`CLOSET ${DOOR.CLOSET.toFixed(1)}'`, rawToCentered(31.7, 22.8), 3.6, 0.7, 0.55);
}

function addLabel(text, pos, sx, sy, y = 0.4) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0f172a";
  ctx.font = "700 48px 'Source Sans 3'";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false })
  );
  sprite.scale.set(sx, sy, 1);
  sprite.position.set(pos.x, y, pos.z);
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
    if (!pointInPolygon(c, RAW.floor)) return false;
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
    const cross =
      zi > point.z !== zj > point.z &&
      point.x < ((xj - xi) * (point.z - zi)) / (zj - zi + Number.EPSILON) + xi;
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
    link:
      String(row.link ?? "https://www.google.com/search?q=furniture").trim() ||
      "https://www.google.com/search?q=furniture",
    image:
      String(row.image ?? "").trim() ||
      "https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=480&q=80",
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

function shapeFromPoints(points) {
  const s = new THREE.Shape();
  s.moveTo(points[0].x, points[0].z);
  for (let i = 1; i < points.length; i += 1) s.lineTo(points[i].x, points[i].z);
  s.lineTo(points[0].x, points[0].z);
  return s;
}

function toCenteredPoint(x, z, center) {
  return { x: x - center.x, z: z - center.z };
}

function centerPoints(points) {
  const center = getCenter(points);
  return points.map((p) => ({ x: p.x - center.x, z: p.z - center.z }));
}

function getCenter(points) {
  const ext = getExtents(points);
  return { x: (ext.minX + ext.maxX) / 2, z: (ext.minZ + ext.maxZ) / 2 };
}

function rawToCentered(x, z) {
  return { x: x - RAW.center.x, z: z - RAW.center.z };
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
