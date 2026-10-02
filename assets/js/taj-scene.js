/**
 * TIFA — a procedural architectural view of the Taj Mahal.
 * Three.js 0.186.1 (MIT) is vendored from the official npm package.
 * No remote assets, tracking, controls dependency, or build step.
 * Artistic interpretation, not an archaeological or survey model.
 */
import * as THREE from '../vendor/three.module.js';

const host = document.getElementById('taj-scene');
const canvas = document.getElementById('taj-canvas');
if (host && canvas) initTaj();

function initTaj() {
  const motionButton = document.getElementById('motion-toggle');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = window.matchMedia('(pointer: coarse)');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    host.classList.add('taj-static');
    host.dataset.motion='unavailable';
    host.dataset.frames='0';
    if (motionButton) motionButton.hidden = true;
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse.matches ? 1.25 : 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf1a46e, 58, 112);
  const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 140);
  const target = new THREE.Vector3(0, 3.1, 2);
  const panoramicTarget = new THREE.Vector3(0, 4, -1.8);
  // Dusk: a low saffron sun on the left, a violet sky fill on the right.
  scene.add(new THREE.HemisphereLight(0xffc9a8, 0x3b2350, 1.75));
  const sun = new THREE.DirectionalLight(0xffa463, 3.6);
  sun.position.set(-22, 13, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(coarse.matches ? 1024 : 2048, coarse.matches ? 1024 : 2048);
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 22;
  sun.shadow.camera.bottom = -22;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 65;
  sun.shadow.normalBias = 0.045;
  sun.shadow.bias = -0.00015;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x9d8ae0, 0.9);
  fill.position.set(14, 12, -15);
  scene.add(fill);

  const marbleTexture = makeMarble();
  const material = {
    marble: new THREE.MeshStandardMaterial({ color: 0xfff9ec, map: marbleTexture, roughness: 0.7 }),
    edge: new THREE.MeshStandardMaterial({ color: 0xf1e5cf, roughness: 0.8 }),
    inset: new THREE.MeshStandardMaterial({ color: 0x4a3328, emissive: 0xff8a2a, emissiveIntensity: 0.32, roughness: 1 }),
    detail: new THREE.MeshStandardMaterial({ color: 0x7f7060, roughness: 0.85 }),
    sandstone: new THREE.MeshStandardMaterial({ color: 0xba7555, roughness: 1 }),
    sandstoneEdge: new THREE.MeshStandardMaterial({ color: 0xd69b77, roughness: 0.9 }),
    lawn: new THREE.MeshStandardMaterial({ color: 0x5f8a50, roughness: 1 }),
    cypress: new THREE.MeshStandardMaterial({ color: 0x2d513e, roughness: 1 }),
    path: new THREE.MeshStandardMaterial({ color: 0xdcc7a7, roughness: 0.95 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xba9250, metalness: 0.65, roughness: 0.3 }),
    water: new THREE.MeshStandardMaterial({ color: 0x2c2a6e, roughness: 0.2, metalness: 0.18, transparent: true, opacity: 0.7, depthWrite: false }),
  };

  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 32);
  const unitSphere = new THREE.SphereGeometry(1, 20, 12);
  const monument = new THREE.Group();
  monument.position.z = -7.5;
  scene.add(monument);

  function mesh(geometry, mat, parent = monument) {
    const item = new THREE.Mesh(geometry, mat);
    item.castShadow = true;
    item.receiveShadow = true;
    parent.add(item);
    return item;
  }
  function box(w, h, d, x, y, z, mat, parent = monument) {
    const item = mesh(unitBox, mat, parent);
    item.scale.set(w, h, d);
    item.position.set(x, y, z);
    return item;
  }
  function cylinder(r, h, x, y, z, mat, parent = monument) {
    const item = mesh(unitCylinder, mat, parent);
    item.scale.set(r, h, r);
    item.position.set(x, y, z);
    return item;
  }
  function sphere(r, x, y, z, mat, parent = monument) {
    const item = mesh(unitSphere, mat, parent);
    item.scale.setScalar(r);
    item.position.set(x, y, z);
    return item;
  }
  function dome(radius, height, x, y, z, parent = monument) {
    const profile = [
      [0.72, 0], [0.82, 0.07], [0.92, 0.17], [1.02, 0.3],
      [1.05, 0.44], [1, 0.56], [0.89, 0.69], [0.74, 0.8],
      [0.54, 0.89], [0.3, 0.96], [0.12, 1.02], [0.035, 1.07], [0, 1.09],
    ].map(([r, v]) => new THREE.Vector2(r * radius, v * height));
    const curve = new THREE.SplineCurve(profile);
    const item = mesh(new THREE.LatheGeometry(curve.getPoints(42), 64), material.marble, parent);
    item.position.set(x, y, z);
    cylinder(radius * 0.75, height * 0.07, x, y + height * 0.035, z, material.edge, parent);
    const tip = y + height * 1.09;
    cylinder(0.032 * radius, height * 0.36, x, tip + height * 0.15, z, material.gold, parent);
    [0.055, 0.13, 0.22].forEach((v, i) => sphere(radius * (0.075 - i * 0.014), x, tip + height * v, z, material.gold, parent));
    const crescent = mesh(new THREE.TorusGeometry(radius * 0.085, radius * 0.012, 6, 20, Math.PI * 1.5), material.gold, parent);
    crescent.position.set(x, tip + height * 0.36, z);
    crescent.rotation.z = Math.PI * 0.75;
    return item;
  }
  function archPath(width, height, bottom = 0, center = 0) {
    const path = new THREE.Path();
    const half = width / 2;
    path.moveTo(center - half, bottom);
    path.lineTo(center - half, bottom + height * 0.58);
    path.bezierCurveTo(center - half, bottom + height * 0.77, center - width * 0.21, bottom + height * 0.91, center, bottom + height);
    path.bezierCurveTo(center + width * 0.21, bottom + height * 0.91, center + half, bottom + height * 0.77, center + half, bottom + height * 0.58);
    path.lineTo(center + half, bottom);
    path.closePath();
    return path;
  }
  function archBand(width, height, x, y, z, band, mat, parent) {
    const outer = archPath(width, height);
    const shape = new THREE.Shape(outer.getPoints(32));
    shape.holes.push(archPath(width - band * 2, height - band * 2, band));
    const item = mesh(new THREE.ShapeGeometry(shape, 32), mat, parent);
    item.position.set(x, y, z);
    return item;
  }
  function facade(width, angle, x, z, isMain = true) {
    const wall = new THREE.Group();
    wall.position.set(x, 1.06, z);
    wall.rotation.y = angle;
    monument.add(wall);
    const h = 5.2;
    const outline = new THREE.Shape();
    outline.moveTo(-width / 2, 0);
    outline.lineTo(width / 2, 0);
    outline.lineTo(width / 2, h);
    outline.lineTo(-width / 2, h);
    outline.closePath();
    if (isMain) {
      outline.holes.push(archPath(2.85, 4.47, 0.06));
      [-2.9, 2.9].forEach(px => {
        outline.holes.push(archPath(1.14, 1.86, 0.22, px));
        outline.holes.push(archPath(1.14, 1.8, 2.6, px));
      });
    } else {
      outline.holes.push(archPath(width * 0.6, 1.92, 0.22));
      outline.holes.push(archPath(width * 0.6, 1.84, 2.62));
    }
    const wallGeometry = new THREE.ExtrudeGeometry(outline, { depth: 0.22, bevelEnabled: false, curveSegments: 16 });
    mesh(wallGeometry, material.marble, wall);
    if (isMain) {
      archBand(3.18, 4.77, 0, 0, 0.236, 0.065, material.detail, wall);
      archBand(3.48, 4.98, 0, 0, 0.238, 0.1, material.edge, wall);
      [-2.9, 2.9].forEach(px => [0.22, 2.6].forEach(py => {
        archBand(1.28, 1.99, px, py - 0.035, 0.236, 0.045, material.detail, wall);
        box(1.55, 0.035, 0.1, px, py + 2.1, 0.24, material.edge, wall);
      }));
      [-1.93, 1.93].forEach(px => box(0.035, h, 0.06, px, h / 2, 0.25, material.detail, wall));
      box(3.92, 0.035, 0.05, 0, 5.04, 0.25, material.detail, wall);
    } else {
      [0.22, 2.62].forEach(py => archBand(width * 0.65, 2.02, 0, py - 0.03, 0.237, 0.035, material.detail, wall));
    }
    [-width / 2, width / 2].forEach(px => box(0.12, h + 0.14, 0.18, px, h / 2, 0.25, material.edge, wall));
    box(width + 0.15, 0.15, 0.46, 0, h + 0.035, 0.05, material.edge, wall);
    box(width, 0.09, 0.27, 0, 2.46, 0.1, material.edge, wall);
  }

  // Raised red sandstone garden terrace and the broad white marble plinth.
  box(23.7, 0.38, 17.5, 0, -0.12, 0, material.sandstone);
  box(22.5, 0.24, 16.4, 0, 0.19, 0, material.sandstoneEdge);
  box(20, 0.46, 14.7, 0, 0.48, 0, material.marble);
  box(20.2, 0.12, 14.9, 0, 0.77, 0, material.edge);
  box(11.4, 0.18, 11.4, 0, 0.94, 0, material.marble);
  box(4.2, 0.16, 1.1, 0, 0.46, 7.65, material.marble);
  box(4.45, 0.12, 1.25, 0, 0.25, 8, material.path);

  // A clipped square plan: four broad façades and four narrow chamfered corners.
  facade(7.6, 0, 0, 5);
  facade(7.6, Math.PI, 0, -5);
  facade(7.6, Math.PI / 2, 5, 0);
  facade(7.6, -Math.PI / 2, -5, 0);
  const cornerWidth = 1.2 * Math.SQRT2;
  facade(cornerWidth, Math.PI / 4, 4.4, 4.4, false);
  facade(cornerWidth, -Math.PI / 4, -4.4, 4.4, false);
  facade(cornerWidth, Math.PI * 3 / 4, 4.4, -4.4, false);
  facade(cornerWidth, -Math.PI * 3 / 4, -4.4, -4.4, false);
  // The recessed interior receives natural arch shadows without fake black decals.
  box(7.25, 4.9, 7.25, 0, 3.51, 0, material.inset);
  const roofShape = new THREE.Shape();
  [[-3.8,-5],[3.8,-5],[5,-3.8],[5,3.8],[3.8,5],[-3.8,5],[-5,3.8],[-5,-3.8]].forEach(([x,z],i) => i ? roofShape.lineTo(x,z) : roofShape.moveTo(x,z));
  roofShape.closePath();
  const roof = mesh(new THREE.ExtrudeGeometry(roofShape, { depth: 0.22, bevelEnabled: false }), material.marble);
  roof.rotation.x = Math.PI / 2;
  roof.position.y = 6.5;
  cylinder(2.18, 0.55, 0, 6.62, 0, material.marble);
  cylinder(2.27, 0.12, 0, 6.94, 0, material.edge);
  dome(2.95, 3.65, 0, 6.92, 0);

  // Four roof chhatris: open galleries, shallow drums and smaller onion domes.
  function kiosk(x, y, z, radius, parent = monument) {
    cylinder(radius * 1.05, 0.13, x, y, z, material.edge, parent);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      cylinder(radius * 0.052, radius * 0.9, x + Math.cos(a) * radius * 0.74, y + radius * 0.47, z + Math.sin(a) * radius * 0.74, material.marble, parent);
    }
    cylinder(radius * 0.97, 0.14, x, y + radius * 0.96, z, material.edge, parent);
    dome(radius * 0.99, radius * 0.92, x, y + radius * 1.03, z, parent);
  }
  [-3.3, 3.3].forEach(x => [-3.3, 3.3].forEach(z => kiosk(x, 6.5, z, 0.86)));

  // Corner pinnacles and marble parapet crenellations.
  const parapet = [];
  for (let i = 0; i < 23; i++) {
    const v = -4.65 + i * 0.423;
    if (Math.abs(v) < 3.85) {
      parapet.push([v, 6.48, 5.06], [v, 6.48, -5.06], [5.06, 6.48, v], [-5.06, 6.48, v]);
    }
  }
  const merlons = new THREE.InstancedMesh(unitBox, material.marble, parapet.length);
  const dummy = new THREE.Object3D();
  parapet.forEach(([x,y,z], i) => { dummy.position.set(x,y,z); dummy.scale.set(0.16,0.2,0.16); dummy.updateMatrix(); merlons.setMatrixAt(i,dummy.matrix); });
  merlons.castShadow = true;
  monument.add(merlons);
  [-4.3, 4.3].forEach(x => [-4.3, 4.3].forEach(z => {
    cylinder(0.09, 0.54, x, 6.77, z, material.marble);
    sphere(0.15, x, 7.1, z, material.edge);
    cylinder(0.021, 0.34, x, 7.28, z, material.gold);
  }));

  // Four tapered minarets, each with three balcony rings and an open chhatri.
  function minaret(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0.82, z);
    monument.add(group);
    cylinder(0.68, 0.25, 0, 0.125, 0, material.edge, group);
    const shaft = mesh(new THREE.CylinderGeometry(0.34, 0.5, 7.9, 32), material.marble, group);
    shaft.position.y = 4.17;
    [2.65, 5.15, 7.75].forEach((y, i) => {
      const r = 0.63 - i * 0.045;
      cylinder(r, 0.16, 0, y, 0, material.edge, group);
      cylinder(r * 1.05, 0.055, 0, y + 0.1, 0, material.marble, group);
      cylinder(r * 0.92, 0.15, 0, y + 0.23, 0, material.marble, group);
      cylinder(r, 0.055, 0, y + 0.34, 0, material.edge, group);
    });
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const seam = box(0.024, 7.35, 0.024, Math.cos(a) * 0.427, 3.98, Math.sin(a) * 0.427, material.edge, group);
      seam.rotation.y = -a;
    }
    kiosk(0, 8.1, 0, 0.54, group);
  }
  [-8.25, 8.25].forEach(x => [-5.6, 5.6].forEach(z => minaret(x,z)));
  // Batch the static architecture by material, preserving real depth and shadows.
  // Hundreds of modeled details become a handful of GPU draw calls.
  batchArchitecture(monument);

  // Charbagh garden: a long turquoise reflecting pool and symmetrical cypress avenues.
  const garden = new THREE.Group();
  scene.add(garden);
  box(8.8, 0.24, 23.5, -7.6, -0.18, 13, material.lawn, garden);
  box(8.8, 0.24, 23.5, 7.6, -0.18, 13, material.lawn, garden);
  box(1.04, 0.17, 24, -3.03, -0.12, 12.9, material.path, garden);
  box(1.04, 0.17, 24, 3.03, -0.12, 12.9, material.path, garden);
  box(0.24, 0.13, 23.8, -2.47, -0.08, 12.9, material.sandstoneEdge, garden);
  box(0.24, 0.13, 23.8, 2.47, -0.08, 12.9, material.sandstoneEdge, garden);
  const pool = mesh(new THREE.PlaneGeometry(4.55, 23.1, 1, 32), material.water, garden);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, 0.012, 12.9);
  pool.castShadow = false;
  pool.receiveShadow = true;
  pool.renderOrder = 4;
  [-2.33, 2.33].forEach(x => box(0.11, 0.18, 23.7, x, 0.02, 12.9, material.edge, garden));
  const treeProfile = [[0.16,0],[0.27,0.2],[0.39,0.75],[0.33,1.5],[0.24,2.16],[0.075,2.7],[0,2.95]].map(([r,y]) => new THREE.Vector2(r,y));
  const treeGeometry = new THREE.LatheGeometry(new THREE.SplineCurve(treeProfile).getPoints(15), 10);
  const trees = new THREE.InstancedMesh(treeGeometry, material.cypress, 24);
  let n = 0;
  [-4.0,4.0].forEach(x => {
    for (let j=0; j<12; j++) {
      dummy.position.set(x, -0.025, 1.9 + j * 1.95);
      const k = 0.9 + (j % 3) * 0.025;
      dummy.scale.set(k,k,k);
      dummy.updateMatrix(); trees.setMatrixAt(n++, dummy.matrix);
    }
  });
  trees.castShadow = true;
  trees.receiveShadow = true;
  garden.add(trees);
  [7.2,16.7].forEach(z => {
    [-7.5,7.5].forEach(x => box(8.6,0.06,0.45,x,-0.025,z,material.path,garden));
  });
  // Fountain stems and understated ripple circles catch the morning light.
  const rippleMaterial = new THREE.MeshBasicMaterial({ color: 0xb8d0bf, transparent: true, opacity: 0.21, depthWrite: false });
  for (let j=0;j<10;j++) {
    const z = 3.2 + j * 2;
    cylinder(0.042,0.18,0,0.09,z,material.edge,garden);
    const ring = mesh(new THREE.RingGeometry(0.16,0.175,24),rippleMaterial,garden);
    ring.rotation.x=-Math.PI/2;
    ring.position.set(0,0.023,z);
    ring.castShadow=false;
    ring.receiveShadow=false;
    ring.renderOrder=5;
  }
  // Oil lamps (diyas) line the pool and the plinth steps; they flicker softly.
  const glow = makeGlow();
  const lampMaterials = [0, 1].map(() => new THREE.PointsMaterial({ map: glow, color: 0xffc46e, size: 1.6, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  const lampSets = [[], []];
  for (let j = 0; j < 22; j++) {
    const z = 2.4 + j * 1.05;
    lampSets[j % 2].push(-2.42, 0.2, z, 2.42, 0.2, z);
  }
  lampSets.forEach((points, i) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    const lamps = new THREE.Points(geometry, lampMaterials[i]);
    lamps.renderOrder = 6;
    garden.add(lamps);
  });
  const terraceLamps = [];
  for (let i = 0; i < 9; i++) terraceLamps.push(-9.6 + i * 2.4, 1.0, -0.2, -9.6 + i * 2.4, 1.0, -14.8);
  [-11.6, 11.6].forEach(x => { for (let i = 0; i < 6; i++) terraceLamps.push(x, 0.3, -14 + i * 2.8); });
  const terraceGeometry = new THREE.BufferGeometry();
  terraceGeometry.setAttribute('position', new THREE.Float32BufferAttribute(terraceLamps, 3));
  const terrace = new THREE.Points(terraceGeometry, lampMaterials[1]);
  terrace.renderOrder = 6;
  scene.add(terrace);

  // A compact architectural diorama retains the pool's full perspective axis
  // in short panoramic heroes and mobile frames without shrinking the monument.
  garden.scale.z=0.7;

  // Planar reflection uses shared geometry. Opaque garden/plinth masks it naturally.
  // It costs no extra render target or secondary rendering pass on mobile devices.
  const reflection = monument.clone(true);
  reflection.position.set(0,0.026,-7.5);
  reflection.scale.y = -1;
  const reflectedMaterials = new Map();
  reflection.traverse(item => {
    if (!item.isMesh) return;
    item.castShadow = false;
    item.receiveShadow = false;
    const source = item.material;
    if (!reflectedMaterials.has(source)) {
      const reflectMaterial = source.clone();
      reflectMaterial.color.multiply(new THREE.Color(0xb59ac8));
      reflectMaterial.side = THREE.DoubleSide;
      reflectedMaterials.set(source, reflectMaterial);
    }
    item.material = reflectedMaterials.get(source);
  });
  scene.add(reflection);

  let userPaused = false;
  let paused = reduced.matches;
  let inView = true;
  let frame = 0;
  let lastFrame = 0;
  let elapsed = 0;
  let pointerX = 0;
  let pointerY = 0;
  let smoothX = 0;
  let smoothY = 0;
  let width = 1;
  let height = 1;
  let contextLost = false;
  let framesDrawn = 0;
  // Opening flight: the camera glides in from high above the gardens.
  let intro = reduced.matches ? 1 : 0;
  const fpsInterval = coarse.matches ? 1000 / 24 : 1000 / 30;

  function updateCamera() {
    const aspect = width / height;
    const horizontalFit = Math.max(1, 0.94 / aspect);
    const panoramic = aspect > 1.8;
    const radius = (panoramic ? 31 : 36.5) * horizontalFit;
    const ease = 1 - Math.pow(1 - intro, 3);
    const away = 1 - ease;
    const angle = 0.095 + (paused ? 0 : Math.sin(elapsed * 0.14) * 0.065) + smoothX * 0.15 - away * 0.85;
    const reach = radius * (1 + away * 0.75);
    camera.position.set(Math.sin(angle) * reach, (panoramic ? 17.8 : 20.5) * horizontalFit + smoothY * 1.1 + away * 26, Math.cos(angle) * reach + (panoramic ? 1 : 4));
    camera.lookAt(panoramic ? panoramicTarget : target);
  }
  function renderFrame() {
    renderer.render(scene,camera);
    host.dataset.frames=String(++framesDrawn);
  }
  function syncMotionState() {
    host.dataset.motion=contextLost ? 'unavailable' : reduced.matches ? 'reduced' : paused ? 'paused' : document.hidden || !inView ? 'suspended' : 'running';
  }
  function draw(now = 0) {
    frame = 0;
    if (contextLost || document.hidden || !inView) return;
    if (!paused && now - lastFrame < fpsInterval) {
      frame = requestAnimationFrame(draw);
      return;
    }
    if (!paused) {
      const step = Math.min((now - lastFrame) / 1000, 0.06);
      elapsed += step;
      if (intro < 1) intro = Math.min(1, intro + step / 4.2);
      lampMaterials.forEach((lamp, i) => { lamp.opacity = 0.78 + Math.sin(elapsed * (6.3 + i * 1.7) + i * 2) * 0.12 + Math.sin(elapsed * 13.1 + i) * 0.08; });
    }
    lastFrame = now;
    smoothX += (pointerX - smoothX) * 0.035;
    smoothY += (pointerY - smoothY) * 0.035;
    updateCamera();
    renderFrame();
    if (!paused) frame = requestAnimationFrame(draw);
  }
  function requestDraw() {
    if (!frame && !contextLost && inView && !document.hidden) frame = requestAnimationFrame(draw);
  }
  function resize() {
    const bounds = host.getBoundingClientRect();
    width = Math.max(bounds.width,1);
    height = Math.max(bounds.height,1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);
    updateCamera();
    renderFrame();
    requestDraw();
  }
  function syncButton() {
    syncMotionState();
    if (!motionButton) return;
    motionButton.disabled=reduced.matches;
    motionButton.setAttribute('aria-pressed',String(paused));
    motionButton.innerHTML = reduced.matches ? 'Animation réduite' : paused ? 'Animer le Taj Mahal <span aria-hidden="true">▷</span>' : 'Pause de l’animation <span aria-hidden="true">Ⅱ</span>';
  }
  motionButton?.addEventListener('click',() => {
    if(reduced.matches) return;
    userPaused = !userPaused;
    intro = 1;
    paused = userPaused;
    pointerX=pointerY=smoothX=smoothY=0;
    syncButton();
    requestDraw();
  });
  reduced.addEventListener('change',event => {
    paused=event.matches || userPaused;
    if (event.matches) intro = 1;
    pointerX=pointerY=smoothX=smoothY=0;
    syncButton(); requestDraw();
  });
  host.addEventListener('pointermove',event => {
    if (coarse.matches || paused || reduced.matches) return;
    const rect=host.getBoundingClientRect();
    pointerX=(event.clientX-rect.left)/rect.width*2-1;
    pointerY=(event.clientY-rect.top)/rect.height*2-1;
    requestDraw();
  },{ passive:true });
  host.addEventListener('pointerleave',() => { pointerX=pointerY=0; },{ passive:true });
  document.addEventListener('visibilitychange',() => {
    if (document.hidden) { cancelAnimationFrame(frame); frame=0; }
    else { lastFrame=performance.now(); requestDraw(); }
    syncMotionState();
  });
  const visibility = new IntersectionObserver(entries => {
    inView=entries[0].isIntersecting;
    if (!inView) { cancelAnimationFrame(frame); frame=0; }
    else { lastFrame=performance.now(); requestDraw(); }
    syncMotionState();
  },{ rootMargin:'80px' });
  visibility.observe(host);
  const sizeObserver=new ResizeObserver(resize);
  sizeObserver.observe(host);
  canvas.addEventListener('webglcontextlost',event => {
    event.preventDefault();
    contextLost=true;
    cancelAnimationFrame(frame);
    frame=0;
    host.classList.remove('taj-ready');
    host.classList.add('taj-static');
    syncMotionState();
    if(motionButton) motionButton.hidden=true;
  });
  canvas.addEventListener('webglcontextrestored',() => {
    contextLost=false;
    host.classList.remove('taj-static');
    host.classList.add('taj-ready');
    if(motionButton) motionButton.hidden=false;
    syncButton();
    resize();
  });
  syncButton();
  resize();
  host.classList.add('taj-ready');
  if (motionButton) motionButton.hidden = false;
  host.dataset.renderer='three-webgl';
  host.dataset.drawCalls=String(renderer.info.render.calls);
  host.dataset.triangles=String(renderer.info.render.triangles);
}

function batchArchitecture(root) {
  root.updateMatrixWorld(true);
  const inverseRoot=new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets=new Map();
  const originals=[];
  root.traverse(item => {
    if (!item.isMesh || item.isInstancedMesh) return;
    const transform=new THREE.Matrix4().multiplyMatrices(inverseRoot,item.matrixWorld);
    const geometry=item.geometry.clone().applyMatrix4(transform);
    if(!buckets.has(item.material)) buckets.set(item.material,[]);
    buckets.get(item.material).push(geometry);
    originals.push(item);
  });
  originals.forEach(item => item.removeFromParent());
  buckets.forEach((pieces,mat) => {
    let vertexCount=0;
    let indexCount=0;
    pieces.forEach(g => { vertexCount+=g.attributes.position.count; indexCount+=g.index ? g.index.count : g.attributes.position.count; });
    const positions=new Float32Array(vertexCount*3);
    const normals=new Float32Array(vertexCount*3);
    const uvs=new Float32Array(vertexCount*2);
    const indices=new Uint32Array(indexCount);
    let vertices=0;
    let cursor=0;
    pieces.forEach(g => {
      const p=g.attributes.position;
      const n=g.attributes.normal;
      const uv=g.attributes.uv;
      positions.set(p.array,vertices*3);
      if(n) normals.set(n.array,vertices*3);
      if(uv) uvs.set(uv.array,vertices*2);
      if(g.index) { for(let i=0;i<g.index.count;i++) indices[cursor++]=g.index.array[i]+vertices; }
      else { for(let i=0;i<p.count;i++) indices[cursor++]=i+vertices; }
      vertices+=p.count;
      g.dispose();
    });
    const merged=new THREE.BufferGeometry();
    merged.setAttribute('position',new THREE.BufferAttribute(positions,3));
    merged.setAttribute('normal',new THREE.BufferAttribute(normals,3));
    merged.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
    merged.setIndex(new THREE.BufferAttribute(indices,1));
    merged.computeBoundingSphere();
    const item=new THREE.Mesh(merged,mat);
    item.castShadow=item.receiveShadow=true;
    root.add(item);
  });
}

function makeGlow() {
  const surface=document.createElement('canvas');
  surface.width=surface.height=64;
  const ctx=surface.getContext('2d');
  const g=ctx.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,248,220,1)');
  g.addColorStop(0.18,'rgba(255,200,110,.9)');
  g.addColorStop(0.45,'rgba(255,140,50,.28)');
  g.addColorStop(1,'rgba(255,120,40,0)');
  ctx.fillStyle=g;
  ctx.fillRect(0,0,64,64);
  const texture=new THREE.CanvasTexture(surface);
  texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}

function makeMarble() {
  const surface=document.createElement('canvas');
  surface.width=surface.height=256;
  const ctx=surface.getContext('2d');
  ctx.fillStyle='#fff9ed';
  ctx.fillRect(0,0,256,256);
  let seed=1914;
  function random() { seed=(seed*16807)%2147483647; return (seed-1)/2147483646; }
  for(let i=0;i<14000;i++) {
    ctx.fillStyle=`rgba(144,127,101,${random()*0.04})`;
    ctx.fillRect(random()*256,random()*256,random()*1.6,random()*1.6);
  }
  for(let i=0;i<7;i++) {
    const x=random()*256;
    ctx.strokeStyle='rgba(143,127,106,.055)';
    ctx.lineWidth=0.45;
    ctx.beginPath(); ctx.moveTo(x,-10);
    ctx.bezierCurveTo(x+15,80,x-28,130,x+25,266);
    ctx.stroke();
  }
  const texture=new THREE.CanvasTexture(surface);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.repeat.set(0.4,0.4);
  return texture;
}
