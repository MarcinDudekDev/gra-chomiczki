/* Chomiczki — Three.js rewrite: real perspective chase-cam runner.
   Road lies on the XZ plane (y=0), player near the camera, track toward -Z.
   Mechanics ported 1:1 from the Phaser PoC (game.js). */

import * as THREE from 'three';
import { t } from './i18n.js';

const params = new URLSearchParams(location.search);
const TEST = params.get('test') === '1';

/* ---------- track geometry (world units) ---------- */
const LANE_W = 2.2;
const ROAD_HALF = LANE_W * 1.5;                        // 3.3
const laneCenterX = i => (i - 1) * LANE_W;             // lanes 0..2 → -2.2, 0, 2.2
const laneBoundaryX = i => (i - 1.5) * LANE_W;         // boundaries 0..3 → -3.3..3.3

/* ---------- mechanics constants (from the PoC spec) ---------- */
const SCROLL = 0.46;            // normalized depth per second
const PLAYER_D = 0.88;          // player plane in normalized depth
const K = 70;                   // world units per unit of normalized depth
const zOfD = d => (d - PLAYER_D) * K;                  // d=0.88 → z=0 (player plane)
const FINISH_T = TEST ? 4 : 26;
const LANE_S = 0.18, DEBOUNCE = 150;
const SPAWN0 = 620, SPAWN_MIN = 360, SPAWN_STEP = 7;
const KILL_D = 1.06, FAR_D = 0.22;

const C = {
  cream: 0xfff3df, road: 0xf3e0c2, road2: 0xe7cda3, wall: 0xd7b488,
  wall2: 0xc59c6f, ink: 0x5b4636, gold: 0xffc94d, wool: 0xb9a48c,
  woolLine: 0x7c6a55, star: 0xffd76b, berry: 0xff7a9c, mint: 0x8fd9b6,
  wood: 0xcf945f, woodDark: 0xa9713f, blue: 0xa9c6e8, edge: 0xdcbd96, line: 0xe6cba0,
};

/* ---------- renderer / scene / camera ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(C.cream);
scene.fog = new THREE.Fog(C.cream, 28, 88);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 400);

scene.add(new THREE.HemisphereLight(0xfff8ec, 0xe2c49c, 1.35));
scene.add(new THREE.AmbientLight(0xfff3df, 0.3));
const sun = new THREE.DirectionalLight(0xffe9c9, 1.0);
sun.position.set(4, 9, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -8; sun.shadow.camera.right = 8;
sun.shadow.camera.top = 10; sun.shadow.camera.bottom = -10;
sun.shadow.camera.far = 60;
sun.shadow.bias = -0.003;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
sun.target.position.set(0, 0, -6);

/* ---------- static world ---------- */
const ROAD_LEN = 240, ROAD_Z = -100;

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(30, ROAD_LEN + 40),
  new THREE.MeshLambertMaterial({ color: C.road2 }));
ground.rotation.x = -Math.PI / 2;
ground.position.set(0, -0.02, ROAD_Z);
ground.receiveShadow = true;
scene.add(ground);

const road = new THREE.Mesh(
  new THREE.PlaneGeometry(ROAD_HALF * 2, ROAD_LEN),
  new THREE.MeshLambertMaterial({ color: C.road }));
road.rotation.x = -Math.PI / 2;
road.position.set(0, 0, ROAD_Z);
road.receiveShadow = true;
scene.add(road);

for (const s of [-1, 1]) {                                 // road edges
  const e = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.05, ROAD_LEN),
    new THREE.MeshLambertMaterial({ color: C.edge }));
  e.position.set(s * ROAD_HALF, 0.025, ROAD_Z);
  scene.add(e);
}
for (const s of [-1, 1]) {                                 // lane dividers: real straight geometry
  const d = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.045, ROAD_LEN),
    new THREE.MeshLambertMaterial({ color: C.line }));
  d.position.set(s * LANE_W / 2, 0.022, ROAD_Z);
  scene.add(d);
}
for (const s of [-1, 1]) {                                 // room walls + baseboards
  const w = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 7.5, ROAD_LEN + 40),
    new THREE.MeshLambertMaterial({ color: C.wall }));
  w.position.set(s * 10.2, 3.75, ROAD_Z);
  scene.add(w);
  const b = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.5, ROAD_LEN + 40),
    new THREE.MeshLambertMaterial({ color: C.wall2 }));
  b.position.set(s * 10.1, 0.25, ROAD_Z);
  scene.add(b);
}

/* ---------- scrolling decor (speed cue) ---------- */
const SPAN = 150, WRAP_Z = 14;
const scrollers = [];

const stripeGeo = new THREE.BoxGeometry(ROAD_HALF * 2 - 0.3, 0.016, 0.55);
const stripeMat = new THREE.MeshLambertMaterial({ color: C.road2, transparent: true, opacity: 0.65 });
for (let i = 0; i < 20; i++) {
  const s = new THREE.Mesh(stripeGeo, stripeMat);
  s.position.set(0, 0.009, WRAP_Z - SPAN + i * (SPAN / 20));
  scene.add(s); scrollers.push(s);
}

const propCols = [C.berry, C.mint, C.gold, C.blue, C.wall2];
for (let i = 0; i < 16; i++) {
  const w = 1 + Math.random() * 1.2, h = 0.8 + Math.random() * 1.8, d = 0.8 + Math.random() * 1.2;
  const p = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color: propCols[i % propCols.length] }));
  const side = i % 2 ? 1 : -1;
  p.position.set(side * (5.8 + Math.random() * 1.2), h / 2, WRAP_Z - SPAN + i * (SPAN / 16));
  p.rotation.y = (Math.random() - 0.5) * 0.6;
  p.castShadow = true;
  scene.add(p); scrollers.push(p);
}

/* ---------- player: hamster in a barrel wheel ---------- */
const player = new THREE.Group();
const wheel = new THREE.Group();

const rimGeo = new THREE.TorusGeometry(1.0, 0.07, 12, 36);
const rimMat = new THREE.MeshLambertMaterial({ color: C.wood });
for (const zz of [-0.27, 0.27]) {
  const r = new THREE.Mesh(rimGeo, rimMat);
  r.position.z = zz; r.castShadow = true;
  wheel.add(r);
}
const rungGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6);
const rungMat = new THREE.MeshLambertMaterial({ color: C.woodDark });
for (let i = 0; i < 14; i++) {
  const a = i / 14 * Math.PI * 2;
  const g = new THREE.Mesh(rungGeo, rungMat);
  g.rotation.x = Math.PI / 2;
  g.position.set(Math.cos(a), Math.sin(a), 0);
  g.castShadow = true;
  wheel.add(g);
}
wheel.position.y = 1.07;
player.add(wheel);
player.scale.setScalar(1.12);

const texLoader = new THREE.TextureLoader();
const runTex = texLoader.load('assets/chomik_run.png');
runTex.colorSpace = THREE.SRGBColorSpace;
runTex.repeat.set(1 / 6, 1);
const laneTex = texLoader.load('assets/chomik_lane.png');
laneTex.colorSpace = THREE.SRGBColorSpace;
laneTex.repeat.set(1 / 3, 1);

const hamMat = new THREE.MeshBasicMaterial({
  map: runTex, transparent: true, alphaTest: 0.08, side: THREE.DoubleSide,
});
const hamster = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), hamMat);
hamster.position.set(0, 1.0, 0.1);
player.add(hamster);
player.position.set(laneCenterX(1), 0, 0);
scene.add(player);

/* ---------- items (world space, pooled) ---------- */
const seedGeo = new THREE.SphereGeometry(0.34, 20, 16);
const seedMat = new THREE.MeshLambertMaterial({ color: C.gold, emissive: 0x4a3205 });
const woolGeo = new THREE.SphereGeometry(0.42, 20, 16);
const woolMat = new THREE.MeshLambertMaterial({ color: C.wool });
const yarnGeo = new THREE.TorusGeometry(0.43, 0.05, 8, 24);
const yarnMat = new THREE.MeshLambertMaterial({ color: C.woolLine });

function starShape(R = 0.52, r = 0.24) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R;
    i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  s.closePath();
  return s;
}
const starGeo = new THREE.ExtrudeGeometry(starShape(), {
  depth: 0.16, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2,
});
starGeo.center();
const starMat = new THREE.MeshLambertMaterial({ color: C.star, emissive: 0x5c4706 });

const builders = {
  seed() {
    const g = new THREE.Group();
    const m = new THREE.Mesh(seedGeo, seedMat);
    m.scale.set(1, 1.28, 1);
    m.position.y = 0.36;
    m.castShadow = true;
    g.add(m);
    g.userData.tick = (it, dt) => { m.rotation.y += dt * 2; };
    return g;
  },
  obs() {
    const g = new THREE.Group(), roll = new THREE.Group();
    const b = new THREE.Mesh(woolGeo, woolMat);
    b.castShadow = true;
    roll.add(b);
    for (const [rx, ry] of [[Math.PI / 2.1, 0], [Math.PI / 3, Math.PI / 3], [-Math.PI / 2.4, -Math.PI / 5]]) {
      const y = new THREE.Mesh(yarnGeo, yarnMat);
      y.rotation.set(rx, ry, 0);
      roll.add(y);
    }
    roll.position.y = 0.44;
    g.add(roll);
    g.userData.tick = (it, dt, v) => { roll.rotation.x += v * K * dt / 0.42; };
    return g;
  },
  power() {
    const g = new THREE.Group();
    const m = new THREE.Mesh(starGeo, starMat);
    m.position.y = 0.78;
    m.castShadow = true;
    g.add(m);
    g.userData.tick = (it, dt) => {
      m.rotation.z += dt * 3;
      m.position.y = 0.78 + Math.sin(it.d * 12) * 0.08;
    };
    return g;
  },
};

const items = [];
const pool = { seed: [], obs: [], power: [] };

function deactivate(it) {
  if (!it.active) return;
  it.active = false;
  it.obj.visible = false;
  pool[it.type].push(it);
}

function spawnItem() {
  const lane = (Math.random() * 3) | 0, r = Math.random();
  let type = r < 0.30 ? 'obs' : (r > 0.92 ? 'power' : 'seed');
  if (type === 'obs') {
    let far = 0;
    for (const it of items) if (it.active && it.type === 'obs' && it.d < FAR_D) far++;
    if (far >= 1) type = 'seed';
  }
  let it = pool[type].pop();
  if (!it) {
    it = { type, active: false, lane: 0, d: 0, obj: builders[type]() };
    scene.add(it.obj);
    items.push(it);
  }
  it.lane = lane;
  it.d = 0.001;
  it.active = true;
  it.obj.visible = true;
  it.obj.position.set(laneCenterX(lane), 0, zOfD(it.d));
}

/* ---------- DOM UI ---------- */
const $ = id => document.getElementById(id);
const menuEl = $('menu'), hudEl = $('hud'), resultEl = $('result'), finishEl = $('finishbanner');
const scoreEl = $('score'), barfillEl = $('barfill'), popupsEl = $('popups');
const startBtn = $('start'), againBtn = $('again');
const starEls = [...document.querySelectorAll('#stars .st')];

function applyStrings() {
  $('mtitle').textContent = t('title');
  $('msub').textContent = t('subtitle');
  startBtn.textContent = t('start');
  startBtn.setAttribute('aria-label', t('aria_start'));
  $('rtitle').textContent = t('bravo');
  againBtn.textContent = t('again');
  againBtn.setAttribute('aria-label', t('aria_again'));
  $('scorewrap').setAttribute('aria-label', t('aria_score'));
  finishEl.textContent = t('finish');
}

const tmpV = new THREE.Vector3();
function pop(key, cls) {
  const el = document.createElement('div');
  el.className = 'pop ' + cls;
  el.textContent = t(key);
  tmpV.set(player.position.x, 2.35, 0).project(camera);
  el.style.insetInlineStart = ((tmpV.x * 0.5 + 0.5) * innerWidth) + 'px';
  el.style.top = ((-tmpV.y * 0.5 + 0.5) * innerHeight) + 'px';
  popupsEl.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

/* ---------- race state ---------- */
let gameState = 'menu';
const race = {
  lane: 1, t: 0, score: 0, stumbles: 0, nowMs: 0, lastSwitch: -1e9,
  spawnAcc: 0, spawnEvery: SPAWN0, stumbleUntil: -1, boostUntil: -1, invulnUntil: -1,
  finished: false, shakeT: 0, tween: null, leanUntil: -1, tintUntil: -1, runT: 0,
};

const eff = () => race.nowMs < race.stumbleUntil ? 0.45 : race.nowMs < race.boostUntil ? 1.55 : 1;

function toLane(z) {
  z = Math.max(0, Math.min(2, z | 0));
  if (gameState !== 'race' || race.finished) return;
  if (race.nowMs - race.lastSwitch < DEBOUNCE || z === race.lane) return;
  const dir = z - race.lane;
  race.lane = z;
  race.lastSwitch = race.nowMs;
  race.tween = { from: player.position.x, to: laneCenterX(z), p: 0 };
  laneTex.offset.x = dir < 0 ? 1 / 3 : 2 / 3;
  hamMat.map = laneTex;
  hamMat.needsUpdate = true;
  race.leanUntil = race.nowMs + LANE_S * 1000 + 140;
}

function collect(it) {
  deactivate(it);
  race.score++;
  scoreEl.textContent = race.score;
  race.boostUntil = race.nowMs + 240;
  pop('plus', '');
}
function powerup(it) {
  deactivate(it);
  race.boostUntil = race.nowMs + 3000;
  race.invulnUntil = race.nowMs + 3000;
  hamMat.color.setHex(0xffe08a);
  race.tintUntil = race.nowMs + 3000;
  pop('star_pop', 'star');
}
function hit(it) {
  deactivate(it);
  race.stumbles++;
  race.stumbleUntil = race.nowMs + 1300;
  race.invulnUntil = race.nowMs + 1100;
  hamMat.color.setHex(0xff8a8a);
  race.tintUntil = race.nowMs + 900;
  race.shakeT = 0.17;
  pop('oj', 'red');
}

function win() {
  race.finished = true;
  finishEl.classList.remove('hidden');
  setTimeout(() => {
    finishEl.classList.add('hidden');
    showResult();
  }, 1100);
}

function showResult() {
  gameState = 'result';
  hudEl.classList.add('hidden');
  const stars = 1 + (race.score >= 8) + (race.stumbles <= 2);
  starEls.forEach((el, i) => el.classList.toggle('on', i < stars));
  $('seednum').textContent = t('seed_count', { n: race.score });
  resultEl.classList.remove('hidden');
}

function startRace() {
  gameState = 'race';
  Object.assign(race, {
    lane: 1, t: 0, score: 0, stumbles: 0, nowMs: 0, lastSwitch: -1e9,
    spawnAcc: 0, spawnEvery: SPAWN0, stumbleUntil: -1, boostUntil: -1, invulnUntil: -1,
    finished: false, shakeT: 0, tween: null, leanUntil: -1, tintUntil: -1,
  });
  for (const it of items) deactivate(it);
  player.position.set(laneCenterX(1), 0, 0);
  hamMat.color.setHex(0xffffff);
  hamMat.map = runTex;
  hamMat.needsUpdate = true;
  scoreEl.textContent = '0';
  barfillEl.style.inlineSize = '0%';
  menuEl.classList.add('hidden');
  resultEl.classList.add('hidden');
  finishEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
}

/* ---------- input ---------- */
startBtn.addEventListener('click', startRace);
againBtn.addEventListener('click', startRace);
addEventListener('keydown', e => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (gameState === 'menu' || gameState === 'result') startRace();
  } else if (e.code === 'ArrowLeft') { e.preventDefault(); toLane(race.lane - 1); }
  else if (e.code === 'ArrowRight') { e.preventDefault(); toLane(race.lane + 1); }
});
addEventListener('pointerdown', e => {
  if (gameState !== 'race' || e.target.closest('button')) return;
  toLane(Math.floor(3 * e.clientX / innerWidth));
});

/* ---------- camera layout (portrait & landscape) ---------- */
let camZ = 7.4, camY = 3.1, camXsmooth = 0;
function layout() {
  const w = innerWidth, h = innerHeight, a = w / h;
  renderer.setSize(w, h);
  camera.aspect = a;
  if (a >= 1) {
    camZ = 7.4; camY = 3.3; camera.fov = 55;
  } else {
    camZ = Math.min(15, 7.4 / a * 0.92);
    camY = camZ * 0.42;
    const need = (ROAD_HALF + 0.45) / (camZ * a);
    camera.fov = THREE.MathUtils.clamp(2 * Math.atan(need) * THREE.MathUtils.RAD2DEG + 1.5, 52, 80);
  }
  camera.updateProjectionMatrix();
  camera.position.set(0, camY, camZ);
  camera.lookAt(0, camY - 0.194 * (camZ + 10), -10);   // ~11° downward tilt → horizon in upper third
}
addEventListener('resize', layout);
layout();

/* ---------- per-frame ---------- */
function updateRace(dt, e, v) {
  race.nowMs += dt * 1000;
  race.t += dt * e;
  race.spawnAcc += dt * 1000;
  if (race.spawnAcc >= race.spawnEvery) {
    race.spawnAcc = 0;
    spawnItem();
    race.spawnEvery = Math.max(SPAWN_MIN, race.spawnEvery - SPAWN_STEP);
  }
  const inv = race.nowMs < race.invulnUntil;
  for (const it of items) {
    if (!it.active) continue;
    const prev = it.d;
    it.d += v * dt;
    if (it.d > KILL_D) { deactivate(it); continue; }
    it.obj.position.z = zOfD(it.d);
    it.obj.userData.tick?.(it, dt, v);
    if (prev < PLAYER_D && it.d >= PLAYER_D && it.lane === race.lane) {
      if (it.type === 'seed') collect(it);
      else if (it.type === 'power') powerup(it);
      else if (!inv) hit(it);
    }
  }
  barfillEl.style.inlineSize = (Math.min(1, race.t / FINISH_T) * 100) + '%';
  if (race.t >= FINISH_T) win();
}

function tick(dt) {
  const racing = gameState === 'race' && !race.finished;
  const e = racing ? eff() : 1;
  const v = SCROLL * e;                                // normalized depth/s
  const vw = racing ? v * K : 0;                       // world units/s

  if (racing) for (const s of scrollers) {
    s.position.z += vw * dt;
    if (s.position.z > WRAP_Z) s.position.z -= SPAN;
  }

  race.runT += dt * (racing ? e : 0.7);
  runTex.offset.x = ((race.runT * 14) | 0) % 6 / 6;
  hamster.position.y = 1.0 + Math.sin(race.runT * 26) * 0.035;
  if (race.leanUntil <= race.nowMs && hamMat.map !== runTex) {
    hamMat.map = runTex;
    hamMat.needsUpdate = true;
  }

  wheel.rotation.z -= (racing ? vw * 0.32 : 2.5) * dt;

  if (race.tween) {
    const tw = race.tween;
    tw.p += dt / LANE_S;
    if (tw.p >= 1) { player.position.x = tw.to; race.tween = null; }
    else player.position.x = tw.from + (tw.to - tw.from) * Math.sin(tw.p * Math.PI / 2);
  }

  if (racing) updateRace(dt, e, v);

  if (race.tintUntil >= 0 && race.nowMs > race.tintUntil) {
    hamMat.color.setHex(0xffffff);
    race.tintUntil = -1;
  }

  race.shakeT = Math.max(0, race.shakeT - dt);
  const sh = race.shakeT > 0 ? (race.shakeT / 0.17) * 0.16 : 0;
  camXsmooth += (player.position.x * 0.22 - camXsmooth) * Math.min(1, dt * 8);
  camera.position.set(
    camXsmooth + (sh ? (Math.random() - 0.5) * sh : 0),
    camY + (sh ? (Math.random() - 0.5) * sh : 0),
    camZ);
}

let last = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  tick(dt);
  renderer.render(scene, camera);
});

applyStrings();

/* ---------- acceptance-test hook ---------- */
window.__chomiczki = {
  THREE, camera, renderer, player,
  state: () => gameState,
  lane: () => race.lane,
  items: () => items.filter(i => i.active).map(i => ({ type: i.type, lane: i.lane, object: i.obj })),
  laneCenterX, laneBoundaryX,
  score: () => race.score,
  stumbles: () => race.stumbles,
};
