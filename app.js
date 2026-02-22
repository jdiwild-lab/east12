import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const INCHES_PER_FOOT = 12;
const DEFAULT_WALL_COLOR = {
  exterior: "#f8fafc",
  interior: "#e6edf6",
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

const camera = new THREE.PerspectiveCamera(55, viewer.clientWidth / viewer.clientHeight, 0.1, 20000);
camera.position.set(240, 340, 280);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xffffff, 0x8ea2b5, 0.75));
const sun = new THREE.DirectionalLight(0xffffff, 0.85);
sun.position.set(300, 500, 180);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const apartmentGroup = new THREE.Group();
const debugGroup = new THREE.Group();
scene.add(apartmentGroup);
scene.add(debugGroup);

const grid = new THREE.GridHelper(2000, 120, 0xa8b1bc, 0xd5dce5);
grid.position.y = 0.01;
scene.add(grid);

const runtime = {
  blueprint: null,
  walls: [],
  openings: [],
  debug: false,
};

window.addEventListener("resize", onResize);
window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "d") {
    runtime.debug = !runtime.debug;
    renderDebug();
  }
});
document.getElementById("debug-toggle-btn")?.addEventListener("click", () => {
  runtime.debug = !runtime.debug;
  renderDebug();
});

animate();
await init();

async function init() {
  try {
    const blueprint = await loadBlueprint("./data/blueprint.json");
    runtime.blueprint = blueprint;
    rebuildFromBlueprint(blueprint);
    setStatus('Blueprint loaded from /data/blueprint.json. Press "D" for debug IDs.');
  } catch (error) {
    setStatus(`Blueprint load failed: ${error.message}`);
  }
}

async function loadBlueprint(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} while loading ${path}`);
  }
  const blueprint = await res.json();
  validateBlueprint(blueprint);
  return blueprint;
}

function validateBlueprint(blueprint) {
  if (!Array.isArray(blueprint.floorOutline)) throw new Error("floorOutline[] is required");
  if (!Array.isArray(blueprint.walls)) throw new Error("walls[] is required");
  if (!Array.isArray(blueprint.openings)) throw new Error("openings[] is required");
  if (!blueprint.calibration?.a || !blueprint.calibration?.b || !blueprint.calibration?.knownInches) {
    throw new Error("calibration {a,b,knownInches} is required");
  }
}

function rebuildFromBlueprint(blueprint) {
  apartmentGroup.clear();
  debugGroup.clear();

  const unitsToInches = makeUnitsToInches(blueprint.calibration);
  const centered = toCenteredGeometry(blueprint, unitsToInches);

  const wallSegments = explodePolylineWalls(centered.walls, blueprint.wallThickness);
  const resolvedOpenings = resolveOpenings(centered.openings, wallSegments, blueprint);

  runtime.walls = wallSegments;
  runtime.openings = resolvedOpenings;

  addFloor(centered.floorOutline);
  buildWallsWithOpenings(wallSegments, resolvedOpenings, blueprint.ceilingHeightIn);
  addWindowGlazing(resolvedOpenings);
  addDoorSwings(resolvedOpenings);

  renderDebug();

  const ext = getExtents(centered.floorOutline);
  controls.target.set((ext.minX + ext.maxX) / 2, 0, (ext.minZ + ext.maxZ) / 2);

  // Expose final explicit openings list after snapping/resolution.
  window.apartmentOpeningOffsets = resolvedOpenings.map((opening) => ({
    id: opening.id,
    type: opening.type,
    wallId: opening.wallId,
    segmentId: opening.segmentId,
    widthIn: opening.widthIn,
    heightIn: opening.heightIn,
    sillHeightIn: opening.sillHeightIn,
    offsetAlongWallIn: Math.round(opening.offsetAlongWallIn),
    hinge: opening.hinge,
    swing: opening.swing,
  }));
}

function makeUnitsToInches(calibration) {
  const dx = calibration.b.x - calibration.a.x;
  const dz = calibration.b.z - calibration.a.z;
  const distUnits = Math.hypot(dx, dz);
  if (distUnits <= 1e-6) throw new Error("Calibration points are coincident");
  const factor = calibration.knownInches / distUnits;
  return (value) => value * factor;
}

function toCenteredGeometry(blueprint, unitsToInches) {
  const floorOutline = blueprint.floorOutline.map((p) => ({
    x: unitsToInches(p.x),
    z: unitsToInches(p.z),
  }));
  const center = getCenter(floorOutline);

  const walls = blueprint.walls.map((wall) => ({
    id: wall.id,
    kind: wall.kind,
    polyline: wall.polyline.map((p) => ({
      x: unitsToInches(p.x) - center.x,
      z: unitsToInches(p.z) - center.z,
    })),
  }));

  const openings = blueprint.openings.map((opening) => ({
    ...opening,
    widthIn: Number(opening.widthIn ?? defaultOpeningWidth(opening, blueprint.defaults)),
    heightIn: Number(opening.heightIn ?? defaultOpeningHeight(opening, blueprint.defaults)),
    sillHeightIn: opening.type === "window"
      ? Number(opening.sillHeightIn ?? blueprint.defaults.window.sillHeightIn)
      : undefined,
    offsetUnits: Number(opening.offsetUnits ?? 0),
    centerOffsetUnits: Number(opening.centerOffsetUnits ?? 0),
    offsetAlongWallIn: opening.type === "door"
      ? unitsToInches(Number(opening.offsetUnits ?? 0))
      : unitsToInches(Number(opening.centerOffsetUnits ?? 0)),
  }));

  return {
    floorOutline: floorOutline.map((p) => ({ x: p.x - center.x, z: p.z - center.z })),
    walls,
    openings,
  };
}

function explodePolylineWalls(walls, wallThickness) {
  const segments = [];
  for (const wall of walls) {
    const thicknessIn = wall.kind === "exterior" ? wallThickness.exteriorIn : wallThickness.interiorIn;
    let running = 0;
    for (let i = 0; i < wall.polyline.length - 1; i += 1) {
      const a = wall.polyline[i];
      const b = wall.polyline[i + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 0.5) continue;
      segments.push({
        id: `${wall.id}__${i}`,
        wallId: wall.id,
        wallKind: wall.kind,
        thicknessIn,
        a,
        b,
        startAlongParentIn: running,
        endAlongParentIn: running + len,
        lengthIn: len,
      });
      running += len;
    }
  }
  return segments;
}

function resolveOpenings(openings, wallSegments, blueprint) {
  const segmentsByWall = new Map();
  for (const segment of wallSegments) {
    if (!segmentsByWall.has(segment.wallId)) segmentsByWall.set(segment.wallId, []);
    segmentsByWall.get(segment.wallId).push(segment);
  }

  const resolved = [];
  for (const opening of openings) {
    const segments = (segmentsByWall.get(opening.wallId) ?? []).sort(
      (s1, s2) => s1.startAlongParentIn - s2.startAlongParentIn
    );
    if (!segments.length) continue;

    const widthIn = opening.widthIn;
    const centerAlong = opening.type === "window" ? opening.offsetAlongWallIn : opening.offsetAlongWallIn + widthIn / 2;

    let host = null;
    for (const segment of segments) {
      if (centerAlong >= segment.startAlongParentIn && centerAlong <= segment.endAlongParentIn) {
        host = segment;
        break;
      }
    }
    if (!host) host = segments[segments.length - 1];

    const startAlongParent = opening.type === "door" ? opening.offsetAlongWallIn : centerAlong - widthIn / 2;
    const startLocal = THREE.MathUtils.clamp(startAlongParent - host.startAlongParentIn, 0, host.lengthIn);
    const endLocal = THREE.MathUtils.clamp(startLocal + widthIn, 0, host.lengthIn);
    if (endLocal - startLocal < 1) continue;

    resolved.push({
      ...opening,
      wallId: host.wallId,
      segmentId: host.id,
      startOffsetIn: startLocal,
      endOffsetIn: endLocal,
      bottomIn: opening.type === "door" ? 0 : opening.sillHeightIn,
      topIn: opening.type === "door" ? opening.heightIn : opening.sillHeightIn + opening.heightIn,
    });
  }

  return resolved;
}

function addFloor(points) {
  const shape = shapeFromPoints(points);
  const floor = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshStandardMaterial({ color: "#e8e0d2", roughness: 0.95 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  apartmentGroup.add(floor);
}

function buildWallsWithOpenings(walls, openings, ceilingHeightIn) {
  const openingsBySegment = new Map();
  for (const opening of openings) {
    if (!openingsBySegment.has(opening.segmentId)) openingsBySegment.set(opening.segmentId, []);
    openingsBySegment.get(opening.segmentId).push(opening);
  }

  for (const wall of walls) {
    const wallOpenings = openingsBySegment.get(wall.id) ?? [];
    buildWallSegment(wall, wallOpenings, ceilingHeightIn);
  }
}

function buildWallSegment(wall, wallOpenings, ceilingHeightIn) {
  const length = wall.lengthIn;
  const dx = wall.b.x - wall.a.x;
  const dz = wall.b.z - wall.a.z;
  const angle = -Math.atan2(dz, dx);

  const boundaries = new Set([0, length]);
  for (const opening of wallOpenings) {
    boundaries.add(THREE.MathUtils.clamp(opening.startOffsetIn, 0, length));
    boundaries.add(THREE.MathUtils.clamp(opening.endOffsetIn, 0, length));
  }
  const split = [...boundaries].sort((a, b) => a - b);

  for (let i = 0; i < split.length - 1; i += 1) {
    const s0 = split[i];
    const s1 = split[i + 1];
    const run = s1 - s0;
    if (run < 0.2) continue;

    const midAlong = (s0 + s1) / 2;
    const blocked = wallOpenings
      .filter((opening) => midAlong > opening.startOffsetIn + 1e-6 && midAlong < opening.endOffsetIn - 1e-6)
      .map((opening) => [Math.max(0, opening.bottomIn), Math.min(ceilingHeightIn, opening.topIn)])
      .filter(([low, high]) => high - low > 0.2)
      .sort((a, b) => a[0] - b[0]);

    const merged = [];
    for (const [low, high] of blocked) {
      const last = merged[merged.length - 1];
      if (!last || low > last[1] + 1e-6) merged.push([low, high]);
      else last[1] = Math.max(last[1], high);
    }

    const solids = [];
    let cursor = 0;
    for (const [low, high] of merged) {
      if (low > cursor + 1e-6) solids.push([cursor, low]);
      cursor = Math.max(cursor, high);
    }
    if (cursor < ceilingHeightIn - 1e-6) solids.push([cursor, ceilingHeightIn]);

    const tangentX = dx / length;
    const tangentZ = dz / length;

    for (const [low, high] of solids) {
      const h = high - low;
      if (h < 0.2) continue;
      const centerAlong = (s0 + s1) / 2;
      const cx = wall.a.x + tangentX * centerAlong;
      const cz = wall.a.z + tangentZ * centerAlong;

      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(run, h, wall.thicknessIn),
        new THREE.MeshStandardMaterial({
          color: DEFAULT_WALL_COLOR[wall.wallKind] ?? "#e2e8f0",
          roughness: 0.8,
        })
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(cx, low + h / 2, cz);
      mesh.rotation.y = angle;
      apartmentGroup.add(mesh);
    }
  }
}

function addWindowGlazing(openings) {
  for (const opening of openings) {
    if (opening.type !== "window") continue;
    const segment = runtime.walls.find((wall) => wall.id === opening.segmentId);
    if (!segment) continue;

    const length = segment.lengthIn;
    const dirX = (segment.b.x - segment.a.x) / length;
    const dirZ = (segment.b.z - segment.a.z) / length;
    const centerAlong = (opening.startOffsetIn + opening.endOffsetIn) / 2;
    const cx = segment.a.x + dirX * centerAlong;
    const cz = segment.a.z + dirZ * centerAlong;
    const openWidth = opening.endOffsetIn - opening.startOffsetIn;
    const openHeight = opening.topIn - opening.bottomIn;

    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(2, openWidth - 1), Math.max(2, openHeight - 1), 1),
      new THREE.MeshStandardMaterial({
        color: "#bde8ff",
        transparent: true,
        opacity: 0.35,
        roughness: 0.08,
      })
    );
    glass.position.set(cx, opening.bottomIn + openHeight / 2, cz);
    glass.rotation.y = -Math.atan2(segment.b.z - segment.a.z, segment.b.x - segment.a.x);
    apartmentGroup.add(glass);
  }
}

function addDoorSwings(openings) {
  for (const door of openings) {
    if (door.type !== "door") continue;
    const segment = runtime.walls.find((wall) => wall.id === door.segmentId);
    if (!segment) continue;

    const length = segment.lengthIn;
    const tangent = new THREE.Vector3((segment.b.x - segment.a.x) / length, 0, (segment.b.z - segment.a.z) / length);
    const hingeAtStart = (door.hinge ?? "left") === "left";
    const hingeOffset = hingeAtStart ? door.startOffsetIn : door.endOffsetIn;
    const hingePoint = new THREE.Vector3(
      segment.a.x + tangent.x * hingeOffset,
      0.5,
      segment.a.z + tangent.z * hingeOffset
    );

    const leafDir = hingeAtStart ? tangent.clone() : tangent.clone().multiplyScalar(-1);
    const rotateSign = (door.swing ?? "in") === "in" ? -1 : 1;
    const openDir = leafDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), rotateSign * Math.PI / 2);
    const radius = door.endOffsetIn - door.startOffsetIn;

    const startAngle = Math.atan2(leafDir.z, leafDir.x);
    const endAngle = Math.atan2(openDir.z, openDir.x);
    const points = [];
    for (let i = 0; i <= 22; i += 1) {
      const t = i / 22;
      const a = startAngle + (endAngle - startAngle) * t;
      points.push(new THREE.Vector3(hingePoint.x + radius * Math.cos(a), 0.5, hingePoint.z + radius * Math.sin(a)));
    }

    apartmentGroup.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: 0x64748b })
      )
    );
  }
}

function renderDebug() {
  debugGroup.clear();
  if (!runtime.debug) return;

  for (const wall of runtime.walls) {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(wall.a.x, 1, wall.a.z),
        new THREE.Vector3(wall.b.x, 1, wall.b.z),
      ]),
      new THREE.LineBasicMaterial({ color: 0xf59e0b })
    );
    debugGroup.add(line);

    const mid = {
      x: (wall.a.x + wall.b.x) / 2,
      z: (wall.a.z + wall.b.z) / 2,
    };
    addDebugLabel(`${wall.wallId}`, mid.x, 10, mid.z, "#111827", "#fde68a");
  }

  for (const opening of runtime.openings) {
    const segment = runtime.walls.find((wall) => wall.id === opening.segmentId);
    if (!segment) continue;
    const len = segment.lengthIn;
    const dirX = (segment.b.x - segment.a.x) / len;
    const dirZ = (segment.b.z - segment.a.z) / len;
    const centerAlong = (opening.startOffsetIn + opening.endOffsetIn) / 2;
    const x = segment.a.x + dirX * centerAlong;
    const z = segment.a.z + dirZ * centerAlong;
    addDebugLabel(opening.id, x, 20, z, "#ffffff", opening.type === "door" ? "#991b1b" : "#0c4a6e");
  }
}

function addDebugLabel(text, x, y, z, fg, bg) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = fg;
  ctx.font = "700 42px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false })
  );
  sprite.scale.set(58, 14, 1);
  sprite.position.set(x, y, z);
  debugGroup.add(sprite);
}

function defaultOpeningWidth(opening, defaults) {
  if (opening.type === "window") return defaults.window.widthIn;
  if (opening.category === "entry") return defaults.door.entryWidthIn;
  if (opening.category === "closet") return defaults.door.closetWidthIn;
  return defaults.door.interiorWidthIn;
}

function defaultOpeningHeight(opening, defaults) {
  if (opening.type === "window") return defaults.window.heightIn;
  return defaults.door.heightIn;
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

function shapeFromPoints(points) {
  const s = new THREE.Shape();
  s.moveTo(points[0].x, points[0].z);
  for (let i = 1; i < points.length; i += 1) s.lineTo(points[i].x, points[i].z);
  s.lineTo(points[0].x, points[0].z);
  return s;
}

function getCenter(points) {
  const ext = getExtents(points);
  return { x: (ext.minX + ext.maxX) / 2, z: (ext.minZ + ext.maxZ) / 2 };
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

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}
