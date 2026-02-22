import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const INCHES_PER_FOOT = 12;
const CEILING_HEIGHT_IN = 114;
const WALL_THICKNESS_IN = { exteriorIn: 8, interiorIn: 4.5 };
const POSITION_SNAP_IN = 3;
const ROTATION_STEP = Math.PI / 2;
const COLLISION_GAP = 0.2;
const CEILING_HEIGHT = inchesToFeet(CEILING_HEIGHT_IN);
const EXTERIOR_WALL_THICKNESS = inchesToFeet(WALL_THICKNESS_IN.exteriorIn);
const INTERIOR_WALL_THICKNESS = inchesToFeet(WALL_THICKNESS_IN.interiorIn);
const POSITION_SNAP = inchesToFeet(POSITION_SNAP_IN);

const ROOM = {
  BEDROOM: { width: 15.83, depth: 16.0 },
  LIVING: { width: 19.92, depth: 17.33 },
  KITCHEN: { width: 8.0, depth: 14.0 },
  BATH: { width: 8.0, depth: 6.0 },
};

const PLAN_REFERENCE = {
  imageSrc: "./floorplan-reference.png",
  imageWidthPx: 1200,
  imageHeightPx: 849,
  calibration: {
    // Two known dimensions from the plan (living room 19'11" and 17'4")
    originPx: { x: 500, y: 186 }, // living room NW interior corner
    xRefPx: { x: 892, y: 186 }, // living room NE interior corner
    zRefPx: { x: 500, y: 434 }, // living room SW interior corner
    xDistanceIn: 239,
    zDistanceIn: 208,
  },
};

const OPENING_SPEC = {
  ceilingHeightIn: 114,
  wallThickness: { exteriorIn: 8, interiorIn: 4.5 },
  defaults: {
    doorHeightIn: 80,
    window: { widthIn: 48, heightIn: 60, sillHeightIn: 24 },
  },
  openings: [
    {
      type: "door",
      id: "entry",
      widthIn: 36,
      heightIn: 80,
      wall: "FOYER_SOUTH",
      hingePlanPx: { x: 760, y: 627 },
      hinge: "left",
      swing: "in",
    },
    {
      type: "door",
      id: "bedroom_entry",
      widthIn: 30,
      heightIn: 80,
      wall: "BED_LIVING",
      hingePlanPx: { x: 499, y: 386 },
      hinge: "right",
      swing: "in",
    },
    {
      type: "door",
      id: "bath_entry",
      widthIn: 30,
      heightIn: 80,
      wall: "BATH_FOYER",
      hingePlanPx: { x: 293, y: 577 },
      hinge: "left",
      swing: "in",
    },
    {
      type: "door",
      id: "bedroom_closet_double",
      widthIn: 48,
      heightIn: 80,
      wall: "BED_LIVING",
      hingePlanPx: { x: 499, y: 260 },
      hinge: "left",
      swing: "in",
    },
    {
      type: "door",
      id: "foyer_closet_1",
      widthIn: 24,
      heightIn: 80,
      wall: "LIVING_FOYER",
      hingePlanPx: { x: 857, y: 452 },
      hinge: "left",
      swing: "in",
    },
    {
      type: "door",
      id: "foyer_closet_2",
      widthIn: 24,
      heightIn: 80,
      wall: "LIVING_FOYER",
      hingePlanPx: { x: 857, y: 531 },
      hinge: "left",
      swing: "in",
    },
    {
      type: "door",
      id: "foyer_closet_3",
      widthIn: 24,
      heightIn: 80,
      wall: "LIVING_FOYER",
      hingePlanPx: { x: 857, y: 604 },
      hinge: "left",
      swing: "in",
    },
    {
      type: "window",
      id: "bedroom_west_1",
      widthIn: 48,
      heightIn: 60,
      sillHeightIn: 24,
      wall: "BEDROOM_WEST",
      centerPlanPx: { x: 145, y: 331 },
    },
    {
      type: "window",
      id: "bedroom_north_1",
      widthIn: 48,
      heightIn: 60,
      sillHeightIn: 24,
      wall: "BEDROOM_NORTH",
      centerPlanPx: { x: 365, y: 186 },
    },
    {
      type: "window",
      id: "bedroom_north_2",
      widthIn: 48,
      heightIn: 60,
      sillHeightIn: 24,
      wall: "BEDROOM_NORTH",
      centerPlanPx: { x: 463, y: 186 },
    },
    {
      type: "window",
      id: "living_north_1",
      widthIn: 48,
      heightIn: 60,
      sillHeightIn: 24,
      wall: "LIVING_NORTH",
      centerPlanPx: { x: 620, y: 186 },
    },
    {
      type: "window",
      id: "living_north_2",
      widthIn: 48,
      heightIn: 60,
      sillHeightIn: 24,
      wall: "LIVING_NORTH",
      centerPlanPx: { x: 735, y: 186 },
    },
    {
      type: "window",
      id: "living_north_3",
      widthIn: 48,
      heightIn: 60,
      sillHeightIn: 24,
      wall: "LIVING_NORTH",
      centerPlanPx: { x: 846, y: 186 },
    },
    {
      type: "window",
      id: "kitchen_north_1",
      widthIn: 48,
      heightIn: 60,
      sillHeightIn: 24,
      wall: "KITCHEN_NORTH",
      centerPlanPx: { x: 946, y: 102 },
    },
    {
      type: "window",
      id: "bath_west_1",
      widthIn: 48,
      heightIn: 60,
      sillHeightIn: 24,
      wall: "BATH_WEST",
      centerPlanPx: { x: 145, y: 548 },
    },
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
window.apartmentOpeningOffsets = RAW.openings.map((opening) => ({
  type: opening.type,
  id: opening.id,
  wall: opening.wallId,
  widthIn: opening.widthIn,
  heightIn: opening.heightIn,
  sillHeightIn: opening.sillHeightIn,
  offsetFromWallStartIn: opening.offsetFromWallStartIn,
  centerOffsetFromWallStartIn: opening.centerOffsetFromWallStartIn,
  hinge: opening.hinge,
  swing: opening.swing,
}));

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

addPlanReferenceUnderlay(RAW.planCalibration);
buildWallsWithOpenings(RAW.walls, RAW.openings);
addRoomLabels();
addDoorSwings();
addWindowGlazing();

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

  const wallsRaw = [
    { id: "BEDROOM_NORTH", kind: "exterior", a: { x: x0, z: zTop }, b: { x: x1, z: zTop } },
    { id: "LIVING_NORTH", kind: "exterior", a: { x: x1, z: zTop }, b: { x: x2, z: zTop } },
    { id: "KITCHEN_NORTH", kind: "exterior", a: { x: x2, z: zTop }, b: { x: x3, z: zTop } },
    { id: "KITCHEN_EAST", kind: "exterior", a: { x: x3, z: zTop }, b: { x: x3, z: zKitchenBottom } },
    { id: "KITCHEN_SOUTH", kind: "exterior", a: { x: x3, z: zKitchenBottom }, b: { x: x2, z: zKitchenBottom } },
    { id: "FOYER_EAST", kind: "exterior", a: { x: x2, z: zKitchenBottom }, b: { x: x2, z: zFoyerBottom } },
    { id: "FOYER_SOUTH", kind: "exterior", a: { x: x2, z: zFoyerBottom }, b: { x: 20, z: zFoyerBottom } },
    { id: "WEST_BATH_FOYER", kind: "interior", a: { x: 20, z: zFoyerBottom }, b: { x: 20, z: zBathBottom } },
    { id: "BATH_SOUTH", kind: "exterior", a: { x: 20, z: zBathBottom }, b: { x: 0, z: zBathBottom } },
    { id: "BATH_WEST", kind: "exterior", a: { x: x0, z: zBathBottom }, b: { x: x0, z: zBedroomBottom } },
    { id: "BEDROOM_WEST", kind: "exterior", a: { x: x0, z: zBedroomBottom }, b: { x: x0, z: zTop } },
    { id: "BED_LIVING", kind: "interior", a: { x: x1, z: zTop }, b: { x: x1, z: zBedroomBottom } },
    { id: "LIVING_FOYER", kind: "interior", a: { x: 20, z: zLivingBottom }, b: { x: 20, z: zFoyerBottom } },
    { id: "BATH_FOYER", kind: "interior", a: { x: 8, z: zBedroomBottom }, b: { x: 20, z: zBedroomBottom } },
    { id: "KITCHEN_LIVING", kind: "interior", a: { x: x2, z: zKitchenBottom }, b: { x: x2, z: zLivingBottom } },
  ];

  const centeredFloor = centerPoints(floorRaw);
  const center = getCenter(floorRaw);

  const walls = wallsRaw.map((wall) => ({
    ...wall,
    a: { x: wall.a.x - center.x, z: wall.a.z - center.z },
    b: { x: wall.b.x - center.x, z: wall.b.z - center.z },
  }));

  const planCalibration = createPlanCalibration(center, x1, zTop);
  const openings = resolveOpenings(OPENING_SPEC, walls, planCalibration);
  const interiorWalls = walls.filter((wall) => wall.kind === "interior");

  return {
    center,
    floor: centeredFloor,
    walls,
    interiorWalls,
    openings,
    planCalibration,
    rooms: {
      bedroom: toCenteredPoint(ROOM.BEDROOM.width * 0.5, ROOM.BEDROOM.depth * 0.52, center),
      living: toCenteredPoint(x1 + ROOM.LIVING.width * 0.5, ROOM.LIVING.depth * 0.5, center),
      kitchen: toCenteredPoint(x2 + ROOM.KITCHEN.width * 0.5, ROOM.KITCHEN.depth * 0.5, center),
      bath: toCenteredPoint(ROOM.BATH.width * 0.5, zBedroomBottom + ROOM.BATH.depth * 0.5, center),
      foyer: toCenteredPoint(x1 + ROOM.LIVING.width * 0.6, 22, center),
    },
  };
}

function createPlanCalibration(center, livingStartX, livingStartZ) {
  const c = PLAN_REFERENCE.calibration;
  const o = c.originPx;
  const x = c.xRefPx;
  const z = c.zRefPx;

  const pxX = { x: x.x - o.x, y: x.y - o.y };
  const pxZ = { x: z.x - o.x, y: z.y - o.y };
  const det = pxX.x * pxZ.y - pxX.y * pxZ.x;
  const safeDet = Math.abs(det) < 1e-6 ? 1 : det;

  const worldOrigin = { x: livingStartX - center.x, z: livingStartZ - center.z };
  const worldXAxis = { x: inchesToFeet(c.xDistanceIn), z: 0 };
  const worldZAxis = { x: 0, z: inchesToFeet(c.zDistanceIn) };

  return {
    image: {
      src: PLAN_REFERENCE.imageSrc,
      widthPx: PLAN_REFERENCE.imageWidthPx,
      heightPx: PLAN_REFERENCE.imageHeightPx,
    },
    originPx: o,
    invPixelBasis: {
      m00: pxZ.y / safeDet,
      m01: -pxZ.x / safeDet,
      m10: -pxX.y / safeDet,
      m11: pxX.x / safeDet,
    },
    worldOrigin,
    worldXAxis,
    worldZAxis,
  };
}

function planPxToWorld(px, calibration) {
  const dx = px.x - calibration.originPx.x;
  const dy = px.y - calibration.originPx.y;
  const a = calibration.invPixelBasis.m00 * dx + calibration.invPixelBasis.m01 * dy;
  const b = calibration.invPixelBasis.m10 * dx + calibration.invPixelBasis.m11 * dy;
  return {
    x: calibration.worldOrigin.x + calibration.worldXAxis.x * a + calibration.worldZAxis.x * b,
    z: calibration.worldOrigin.z + calibration.worldXAxis.z * a + calibration.worldZAxis.z * b,
  };
}

function projectPointToWall(point, wall) {
  const dx = wall.b.x - wall.a.x;
  const dz = wall.b.z - wall.a.z;
  const len2 = dx * dx + dz * dz;
  if (len2 <= 1e-9) return { offsetFt: 0, distanceFt: Infinity };
  const tRaw = ((point.x - wall.a.x) * dx + (point.z - wall.a.z) * dz) / len2;
  const t = THREE.MathUtils.clamp(tRaw, 0, 1);
  const projX = wall.a.x + dx * t;
  const projZ = wall.a.z + dz * t;
  return {
    offsetFt: Math.hypot(projX - wall.a.x, projZ - wall.a.z),
    distanceFt: Math.hypot(point.x - projX, point.z - projZ),
  };
}

function snapPlanPointToWall(planPointPx, walls, calibration, wallHint) {
  const worldPoint = planPxToWorld(planPointPx, calibration);
  let best = null;
  for (const wall of walls) {
    const proj = projectPointToWall(worldPoint, wall);
    if (!best || proj.distanceFt < best.distanceFt) best = { wall, ...proj, sourceHint: wallHint ?? null };
  }
  return best;
}

function resolveOpenings(spec, walls, planCalibration) {
  const wallMap = new Map(walls.map((wall) => [wall.id, wall]));
  return spec.openings
    .map((opening) => {
      let snapped = null;
      if (opening.type === "door" && opening.hingePlanPx) {
        snapped = snapPlanPointToWall(opening.hingePlanPx, walls, planCalibration, opening.wall);
      }
      if (opening.type === "window" && opening.centerPlanPx) {
        snapped = snapPlanPointToWall(opening.centerPlanPx, walls, planCalibration, opening.wall);
      }

      const wall = snapped?.wall ?? wallMap.get(opening.wall);
      if (!wall) return null;
      const widthFt = inchesToFeet(opening.widthIn ?? spec.defaults.window.widthIn);
      const wallLen = wallLength(wall);
      const hingeOffsetFallbackFt = inchesToFeet(opening.offsetFromWallStartIn ?? 0);
      const startFt = opening.type === "door"
        ? (opening.hinge === "left"
          ? (snapped?.offsetFt ?? hingeOffsetFallbackFt)
          : (snapped?.offsetFt ?? hingeOffsetFallbackFt) - widthFt)
        : (snapped
          ? snapped.offsetFt - widthFt / 2
          : inchesToFeet((opening.centerOffsetFromWallStartIn ?? 0) - opening.widthIn / 2));
      const clampedStart = THREE.MathUtils.clamp(startFt, 0, wallLen);
      const clampedEnd = THREE.MathUtils.clamp(clampedStart + widthFt, 0, wallLen);
      if (clampedEnd - clampedStart < 0.02) return null;

      if (opening.type === "door") {
        return {
          ...opening,
          wallId: wall.id,
          wall,
          startOffsetFt: clampedStart,
          endOffsetFt: clampedEnd,
          offsetFromWallStartIn: Math.round(clampedStart * INCHES_PER_FOOT),
          bottomFt: 0,
          topFt: inchesToFeet(opening.heightIn ?? spec.defaults.doorHeightIn),
        };
      }

      const sill = inchesToFeet(opening.sillHeightIn ?? spec.defaults.window.sillHeightIn);
      const height = inchesToFeet(opening.heightIn ?? spec.defaults.window.heightIn);
      return {
        ...opening,
        wallId: wall.id,
        wall,
        startOffsetFt: clampedStart,
        endOffsetFt: clampedEnd,
        centerOffsetFromWallStartIn: Math.round(((clampedStart + clampedEnd) / 2) * INCHES_PER_FOOT),
        bottomFt: sill,
        topFt: sill + height,
      };
    })
    .filter(Boolean);
}

function addPlanReferenceUnderlay(calibration) {
  if (!calibration?.image?.src) return;
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(
    calibration.image.src,
    (texture) => {
      const w = calibration.image.widthPx;
      const h = calibration.image.heightPx;
      const p00 = planPxToWorld({ x: 0, y: 0 }, calibration);
      const p10 = planPxToWorld({ x: w, y: 0 }, calibration);
      const p11 = planPxToWorld({ x: w, y: h }, calibration);
      const p01 = planPxToWorld({ x: 0, y: h }, calibration);

      const geometry = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        p00.x, 0.02, p00.z,
        p10.x, 0.02, p10.z,
        p11.x, 0.02, p11.z,
        p01.x, 0.02, p01.z,
      ]);
      const uvs = new Float32Array([
        0, 1,
        1, 1,
        1, 0,
        0, 0,
      ]);
      geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
      geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
      geometry.setIndex([0, 1, 2, 0, 2, 3]);
      geometry.computeVertexNormals();

      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: 0.42,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      mesh.renderOrder = -1;
      apartmentGroup.add(mesh);
    },
    undefined,
    () => {
      setStatus('Reference image not loaded. Place "floorplan-reference.png" next to index.html.');
    }
  );
}

function buildWallsWithOpenings(walls, openings) {
  const openingsByWall = new Map();
  for (const opening of openings) {
    if (!openingsByWall.has(opening.wallId)) openingsByWall.set(opening.wallId, []);
    openingsByWall.get(opening.wallId).push(opening);
  }

  for (const wall of walls) {
    const wallOpenings = openingsByWall.get(wall.id) ?? [];
    buildWallMeshFromOpenings(wall, wallOpenings);
  }
}

function buildWallMeshFromOpenings(wall, wallOpenings) {
  const dx = wall.b.x - wall.a.x;
  const dz = wall.b.z - wall.a.z;
  const length = Math.hypot(dx, dz);
  if (length < 0.05) return;

  const thickness = wall.kind === "exterior" ? EXTERIOR_WALL_THICKNESS : INTERIOR_WALL_THICKNESS;
  const color = wall.kind === "exterior" ? "#f8fafc" : "#e6edf6";
  const boundaries = new Set([0, length]);

  for (const opening of wallOpenings) {
    boundaries.add(THREE.MathUtils.clamp(opening.startOffsetFt, 0, length));
    boundaries.add(THREE.MathUtils.clamp(opening.endOffsetFt, 0, length));
  }

  const splits = [...boundaries].sort((a, b) => a - b);
  const tangentX = dx / length;
  const tangentZ = dz / length;
  const angle = -Math.atan2(dz, dx);

  for (let i = 0; i < splits.length - 1; i += 1) {
    const s0 = splits[i];
    const s1 = splits[i + 1];
    const segmentLen = s1 - s0;
    if (segmentLen < 0.02) continue;
    const mid = (s0 + s1) / 2;

    const blocked = wallOpenings
      .filter((opening) => mid > opening.startOffsetFt + 1e-6 && mid < opening.endOffsetFt - 1e-6)
      .map((opening) => [Math.max(0, opening.bottomFt), Math.min(CEILING_HEIGHT, opening.topFt)])
      .filter(([low, high]) => high - low > 0.01)
      .sort((a, b) => a[0] - b[0]);

    const mergedBlocked = [];
    for (const [low, high] of blocked) {
      const last = mergedBlocked[mergedBlocked.length - 1];
      if (!last || low > last[1] + 1e-6) mergedBlocked.push([low, high]);
      else last[1] = Math.max(last[1], high);
    }

    const solidRanges = [];
    let cursor = 0;
    for (const [low, high] of mergedBlocked) {
      if (low > cursor + 1e-6) solidRanges.push([cursor, low]);
      cursor = Math.max(cursor, high);
    }
    if (cursor < CEILING_HEIGHT - 1e-6) solidRanges.push([cursor, CEILING_HEIGHT]);

    for (const [low, high] of solidRanges) {
      const h = high - low;
      if (h < 0.02) continue;
      const localMid = (s0 + s1) / 2;
      const cx = wall.a.x + tangentX * localMid;
      const cz = wall.a.z + tangentZ * localMid;
      const wallPiece = new THREE.Mesh(
        new THREE.BoxGeometry(segmentLen, h, thickness),
        new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
      );
      wallPiece.castShadow = true;
      wallPiece.receiveShadow = true;
      wallPiece.position.set(cx, low + h / 2, cz);
      wallPiece.rotation.y = angle;
      apartmentGroup.add(wallPiece);
    }
  }
}

function addRoomLabels() {
  addLabel("BEDROOM", RAW.rooms.bedroom, 6.4, 1.5, 4.8);
  addLabel("LIVING ROOM", RAW.rooms.living, 7.5, 1.5, 4.8);
  addLabel("KITCHEN", RAW.rooms.kitchen, 5.2, 1.4, 4.8);
  addLabel("BATH", RAW.rooms.bath, 3.8, 1.2, 4.8);
  addLabel("FOYER", RAW.rooms.foyer, 3.8, 1.2, 4.8);
}

function addWindowGlazing() {
  for (const opening of RAW.openings) {
    if (opening.type !== "window") continue;
    const wall = opening.wall;
    const length = wallLength(wall);
    const dirX = (wall.b.x - wall.a.x) / length;
    const dirZ = (wall.b.z - wall.a.z) / length;
    const centerOffset = (opening.startOffsetFt + opening.endOffsetFt) / 2;
    const cx = wall.a.x + dirX * centerOffset;
    const cz = wall.a.z + dirZ * centerOffset;
    const openingWidth = opening.endOffsetFt - opening.startOffsetFt;
    const openingHeight = opening.topFt - opening.bottomFt;

    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(openingWidth - 0.08, openingHeight - 0.08, 1 / INCHES_PER_FOOT),
      new THREE.MeshStandardMaterial({
        color: "#bde8ff",
        transparent: true,
        opacity: 0.32,
        metalness: 0,
        roughness: 0.05,
      })
    );
    glass.position.set(cx, opening.bottomFt + openingHeight / 2, cz);
    glass.rotation.y = -Math.atan2(wall.b.z - wall.a.z, wall.b.x - wall.a.x);
    apartmentGroup.add(glass);
  }
}

function addDoorSwings() {
  for (const door of RAW.openings) {
    if (door.type !== "door") continue;
    const wall = door.wall;
    const length = wallLength(wall);
    const tangent = new THREE.Vector3((wall.b.x - wall.a.x) / length, 0, (wall.b.z - wall.a.z) / length);
    const hingeOffset = door.hinge === "left" ? door.startOffsetFt : door.endOffsetFt;
    const hingePoint = new THREE.Vector3(
      wall.a.x + tangent.x * hingeOffset,
      0.06,
      wall.a.z + tangent.z * hingeOffset
    );
    const closedDir = door.hinge === "left" ? tangent.clone() : tangent.clone().multiplyScalar(-1);
    const rotateSign = door.swing === "in" ? -1 : 1;
    const openDir = closedDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), rotateSign * Math.PI / 2);
    const radius = door.endOffsetFt - door.startOffsetFt;
    const startAngle = Math.atan2(closedDir.z, closedDir.x);
    const endAngle = Math.atan2(openDir.z, openDir.x);
    const points = [];
    for (let i = 0; i <= 22; i += 1) {
      const t = i / 22;
      const a = startAngle + (endAngle - startAngle) * t;
      points.push(new THREE.Vector3(hingePoint.x + radius * Math.cos(a), 0.06, hingePoint.z + radius * Math.sin(a)));
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
          hingePoint,
          points[points.length - 1],
        ]),
        new THREE.LineBasicMaterial({ color: 0x94a3b8 })
      )
    );
  }
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

function inchesToFeet(valueIn) {
  return valueIn / INCHES_PER_FOOT;
}

function wallLength(wall) {
  return Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z);
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
