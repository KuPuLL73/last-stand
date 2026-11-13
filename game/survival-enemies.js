import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {CubicMobs} from './minecraft-mobs.js';
import {createWitherSkullBatch} from './minecraft-projectiles.js';
import {createExtraProjectileGeometry} from './extra-projectiles.js';
import {BOOSTS,BOOST_POSES,createBoostGeometry,createBoostMaterial,createBoostAuraGeometry,createBoostAuraMaterial} from './boost-models.js';

// Every character is three batches (body, arms, legs), with vertex colours.
// Their independent joint transforms keep the horde animated without creating
// one draw call per eye, sleeve or hand.
const LIMITS = { enemies: 80, projectiles: 480, drops: 220, warnings: 20 };
const UP = new THREE.Vector3(0, 1, 0);
const UNIT_SCALE = new THREE.Vector3(1, 1, 1);

function shapeBuilder() {
  const pieces = [];
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const colour = new THREE.Color();
  function add(kind, hex, p = [0, 0, 0], s = [1, 1, 1], r = [0, 0, 0]) {
    let g;
    if (kind === 'ball') g = new THREE.SphereGeometry(1, 10, 8);
    else if (kind === 'capsule') g = new THREE.CapsuleGeometry(.5, 1, 4, 8);
    else if (kind === 'cone') g = new THREE.ConeGeometry(.5, 1, 8);
    else if (kind === 'cylinder') g = new THREE.CylinderGeometry(.5, .5, 1, 10);
    else if (kind === 'gem') g = new THREE.OctahedronGeometry(1);
    else if (kind === 'half-torus') g = new THREE.TorusGeometry(.5, .13, 6, 16, Math.PI);
    else if (kind === 'sparkle') {
      const star = new THREE.Shape();
      star.moveTo(0, .5); star.lineTo(.10, .10); star.lineTo(.5, 0); star.lineTo(.10, -.10);
      star.lineTo(0, -.5); star.lineTo(-.10, -.10); star.lineTo(-.5, 0); star.lineTo(-.10, .10); star.closePath();
      g = new THREE.ExtrudeGeometry(star, { depth: .025, bevelEnabled: false, steps: 1 });
    }
    else if (kind === 'shield') {
      const outline = new THREE.Shape();
      outline.moveTo(-.5, .45); outline.lineTo(0, .59); outline.lineTo(.5, .45);
      outline.lineTo(.42, -.17); outline.quadraticCurveTo(.29, -.44, 0, -.63);
      outline.quadraticCurveTo(-.29, -.44, -.42, -.17); outline.closePath();
      g = new THREE.ExtrudeGeometry(outline, { depth: .11, bevelEnabled: true, bevelThickness: .025, bevelSize: .025, bevelSegments: 1, steps: 1, curveSegments: 3 });
      g.translate(0, 0, -.055);
    }
    else g = new THREE.BoxGeometry(1, 1, 1);
    if (!g.index) g.setIndex(Array.from({ length: g.attributes.position.count }, (_, i) => i));
    matrix.compose(position.fromArray(p), quaternion.setFromEuler(euler.set(...r)), scale.fromArray(s));
    g.applyMatrix4(matrix);
    colour.set(hex);
    const colours = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colours.length; i += 3) colour.toArray(colours, i);
    g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    // Equal attributes let the parts share one geometry/material.
    g.deleteAttribute('uv');
    pieces.push(g);
  }
  return {
    add,
    finish() {
      const g = mergeGeometries(pieces, false);
      for (const p of pieces) p.dispose();
      g.computeBoundingSphere();
      return g;
    },
  };
}

// One shared faceted cut for every XP gem. A table, girdle and tapered bottom
// read as a jewel from the top-down camera rather than a tiny floating dot.
function jewelGeometry() {
  const vertices = [], colours = [];
  const shades = ['#e3fcff', '#7ae5ff', '#b7f4ff', '#58c7f4', '#a2efff', '#72ddff', '#c9faff', '#45b8ee'];
  const colour = new THREE.Color();
  function triangle(a, b, c, hex) {
    vertices.push(...a, ...b, ...c); colour.set(hex);
    for (let i = 0; i < 3; i++) colours.push(colour.r, colour.g, colour.b);
  }
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, b = (i + 1) * Math.PI / 4;
    const topA = [Math.cos(a) * .15, .17, Math.sin(a) * .15];
    const topB = [Math.cos(b) * .15, .17, Math.sin(b) * .15];
    const edgeA = [Math.cos(a) * .26, .035, Math.sin(a) * .26];
    const edgeB = [Math.cos(b) * .26, .035, Math.sin(b) * .26];
    triangle([0, .22, 0], topB, topA, '#e8fdff');
    triangle(topA, topB, edgeB, shades[i]); triangle(topA, edgeB, edgeA, shades[(i + 2) % 8]);
    triangle(edgeA, edgeB, [0, -.31, 0], shades[(i + 4) % 8]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  g.computeVertexNormals(); g.computeBoundingSphere(); return g;
}


function humanoid(type) {
  const boss = type === 'boss', runner = type === 'runner', spitter = type === 'spitter';
  const palette = {
    skin: boss ? '#81a77c' : runner ? '#9cb96d' : spitter ? '#a8a279' : '#78ae82',
    shade: boss ? '#567e65' : runner ? '#6f9256' : '#4d8063',
    shirt: boss ? '#c6843e' : runner ? '#dd9246' : spitter ? '#484d7e' : '#79639b',
    collar: boss ? '#66483e' : runner ? '#f3cc75' : spitter ? '#2b3754' : '#4c4271',
    pants: boss ? '#394d57' : runner ? '#47586b' : '#455c65',
    boots: '#2b4047', metal: '#5c7784', dark: '#24343a', eyes: '#fff1b8',
  };
  const body = shapeBuilder(), arm = shapeBuilder(), leg = shapeBuilder();
  const width = boss ? .38 : runner ? .245 : .29;
  body.add('capsule', palette.shirt, [0, .94, 0], [width * 2, .29, .39]);
  body.add('box', palette.pants, [0, .655, 0], [width * 1.85, .23, .34]);
  body.add('box', palette.collar, [0, .74, .19], [width * 2, .075, .06]);
  body.add('box', '#b6ab83', [.06, .74, .235], [.13, .10, .035]);
  body.add('cylinder', palette.skin, [0, 1.255, 0], [.21, .20, .20]);
  if (spitter) {
    body.add('ball', '#343d68', [0, 1.51, -.095], [.405, .395, .345]);
    body.add('ball', palette.skin, [0, 1.48, .10], [.285, .30, .265]);
    body.add('cylinder', '#a4d369', [-.18, 1.03, -.34], [.23, .72, .23]);
    body.add('cylinder', '#8ac55d', [.18, 1.03, -.34], [.23, .72, .23]);
    for (const x of [-.18, .18]) {
      body.add('box', palette.metal, [x, .79, -.34], [.26, .08, .26]);
      body.add('box', palette.metal, [x, 1.25, -.34], [.26, .08, .26]);
      body.add('ball', '#e7ed99', [x, 1.41, -.34], [.10, .10, .10]);
    }
    body.add('cylinder', palette.dark, [0, 1.37, .354], [.22, .07, .22], [Math.PI / 2, 0, 0]);
    body.add('ball', '#aee26b', [0, 1.37, .403], [.07, .06, .025]);
  } else {
    body.add('ball', palette.skin, [0, 1.49, .015], [boss ? .355 : .326, .319, .30]);
    body.add('box', palette.skin, [0, 1.32, .055], [boss ? .50 : .43, .19, .39]);
    body.add('box', palette.dark, [0, 1.345, .273], [.29, .082, .022]);
    for (const [i, x] of [-.095, 0, .095].entries()) {
      body.add('box', '#f9ecc4', [x, 1.369 - (i % 2) * .012, .289], [.064, .047, .018]);
    }
    body.add('box', palette.shade, [.008, 1.46, .322], [.11, .09, .09]);
  }
  for (const side of [-1, 1]) {
    const x = side * .127;
    body.add('ball', palette.skin, [side * .323, 1.45, -.005], [.082, .115, .07]);
    body.add('ball', palette.eyes, [x, 1.54, .287 + (spitter ? .037 : 0)], [.083, side === 1 ? .087 : .073, .024]);
    body.add('ball', boss ? '#ef9d3d' : palette.dark, [x - .006, 1.532, .309 + (spitter ? .037 : 0)], [.033, .046, .012]);
    body.add('box', palette.dark, [x, 1.629, .303 + (spitter ? .025 : 0)], [.20, .048, .045], [0, 0, side * .19]);
    body.add('box', palette.shade, [side * .222, 1.408, .274], [.07, .019, .021], [0, 0, side * -.35]);
  }
  // Different costume silhouettes remain readable from the game camera.
  if (runner) {
    body.add('ball', '#cb7642', [0, 1.738, -.028], [.33, .145, .28]);
    body.add('box', '#f0b45a', [0, 1.726, .255], [.52, .065, .30], [-.10, 0, 0]);
    body.add('box', '#fae0a0', [-.12, 1.018, .214], [.10, .25, .035], [0, 0, -.18]);
    body.add('box', '#fae0a0', [.12, 1.018, .214], [.10, .25, .035], [0, 0, .18]);
    body.add('box', '#664132', [0, .86, .227], [.34, .055, .04]);
  } else if (boss) {
    body.add('box', palette.metal, [0, 1.015, .235], [.57, .40, .13]);
    body.add('box', '#8ca1a2', [0, 1.055, .311], [.35, .13, .035]);
    body.add('box', palette.dark, [0, 1.015, .335], [.10, .10, .035]);
    for (const side of [-1, 1]) {
      body.add('ball', palette.metal, [side * .43, 1.18, 0], [.235, .16, .255]);
      body.add('cone', '#b6c2b2', [side * .43, 1.38, -.01], [.09, .20, .09]);
    }
    body.add('cylinder', palette.dark, [0, 1.77, -.025], [.76, .09, .65]);
    body.add('cylinder', palette.collar, [0, 1.89, -.025], [.56, .24, .50]);
    body.add('box', '#dca353', [0, 1.82, .249], [.21, .10, .045]);
  } else {
    body.add('box', '#c4bea0', [-.13, .97, .213], [.18, .12, .035], [0, 0, -.14]);
    body.add('box', '#a8a17f', [.15, 1.12, .196], [.042, .042, .035]);
    body.add('box', '#a8a17f', [.15, .97, .216], [.042, .042, .035]);
    body.add('box', palette.skin, [.185, 1.697, .10], [.16, .055, .05], [0, 0, -.25]);
  }
  // Shoulder pivot is the origin of the limb geometry.
  arm.add('capsule', palette.skin, [0, -.29, 0], [boss ? .28 : .18, .19, boss ? .26 : .18]);
  arm.add('capsule', palette.shirt, [0, -.09, 0], [boss ? .33 : .23, .09, boss ? .31 : .22]);
  arm.add('ball', palette.skin, [0, -.51, .025], [boss ? .19 : .13, boss ? .20 : .14, boss ? .18 : .135]);
  for (const x of [-.075, 0, .075]) arm.add('box', palette.shade, [x * (boss ? 1.6 : 1), -.536, .135], [.035, .05, .025]);
  if (boss) {
    arm.add('box', palette.metal, [0, -.425, .02], [.34, .30, .33]);
    arm.add('box', '#91a8ad', [0, -.405, .195], [.26, .15, .05]);
    arm.add('cone', '#c4d1c6', [0, -.32, .27], [.09, .23, .09], [Math.PI / 2, 0, 0]);
  }
  leg.add('capsule', palette.pants, [0, -.23, 0], [runner ? .15 : .205, .20, runner ? .17 : .20]);
  leg.add('box', palette.boots, [0, -.48, .06], [boss ? .27 : .22, .18, .33]);
  leg.add('box', runner ? '#d4ae68' : '#88998c', [0, -.365, .10], [runner ? .17 : .20, .065, .055]);
  return {
    body: body.finish(), arm: arm.finish(), leg: leg.finish(),
    scale: boss ? 1.62 : runner ? .95 : 1,
    shoulder: boss ? .43 : runner ? .275 : .32,
    hip: boss ? .23 : runner ? .125 : .16,
  };
}

export class SurvivalEnemies {
  constructor(scene, { mobile = false, camera = null, reducedMotion = false } = {}) {
    this.camera = camera;
    this.reducedMotion = reducedMotion;
    this.scene = scene;
    this.mobile = mobile;
    this.group = new THREE.Group();
    this.group.name = 'Survival enemies and pickups';
    scene.add(this.group);
    this.cubicMobs=new CubicMobs(this.group,{mobile});
    this.meshes = [];
    this.models = {};
    this.materials = new Set();
    this._dummy = new THREE.Object3D();
    this._root = new THREE.Matrix4();
    this._child = new THREE.Matrix4();
    this._composed = new THREE.Matrix4();
    this._position = new THREE.Vector3();
    this._scale = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._tint = new THREE.Color();
    const skinMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92, flatShading: true });
    this.materials.add(skinMaterial);
    for (const type of ['walker', 'runner', 'spitter', 'boss']) {
      const spec = humanoid(type), n = type === 'boss' ? 2 : LIMITS.enemies;
      this.models[type] = {
        ...spec, count: 0,
        bodyMesh: this.batch(spec.body, skinMaterial, n, !mobile),
        armMesh: this.batch(spec.arm, skinMaterial, n * 2, false),
        legMesh: this.batch(spec.leg, skinMaterial, n * 2, false),
      };
    }
    const basic = (color, options = {}) => {
      const m = new THREE.MeshBasicMaterial({ color, ...options });
      this.materials.add(m);
      return m;
    };
    const standard = (color, options = {}) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: .65, ...options });
      this.materials.add(m);
      return m;
    };
    const shadowGeo = new THREE.CircleGeometry(.48, 20); shadowGeo.rotateX(-Math.PI / 2);
    this.shadows = this.batch(shadowGeo, basic('#203d36', { transparent: true, opacity: .18, depthWrite: false }), LIMITS.enemies + 2);
    this.hpBackground = this.batch(new THREE.BoxGeometry(1, 1, 1), basic('#263d42'), LIMITS.enemies + 2);
    this.hpForeground = this.batch(new THREE.BoxGeometry(1, 1, 1), basic('#b1e485'), LIMITS.enemies + 2);
    this.gems = this.batch(jewelGeometry(), standard('#51cfff', { vertexColors: true, emissive: '#0967c3', emissiveIntensity: .42, metalness: .28, roughness: .27 }), LIMITS.drops);
    const glowGeo = new THREE.RingGeometry(.25, .39, 28); glowGeo.rotateX(-Math.PI / 2);
    this.gemGlows = this.batch(glowGeo, basic('#3fcaf7', { transparent: true, opacity: .30, depthWrite: false }), LIMITS.drops);
    const baseGeo = new THREE.CircleGeometry(.37, 24); baseGeo.rotateX(-Math.PI / 2);
    this.gemBases = this.batch(baseGeo, basic('#245f75', { transparent: true, opacity: .11, depthWrite: false }), LIMITS.drops);
    const shine = shapeBuilder();
    shine.add('sparkle', '#f4fdff', [-.09, .13, .20], [.22, .26, .16], [0, 0, -.18]);
    this.gemShines = this.batch(shine.finish(), basic('#e7fbff', { toneMapped: false }), LIMITS.drops);
    this.pickups = {};this.pickupAuras={};
    this.pickupColours = Object.fromEntries(Object.entries(BOOSTS).map(([id,b])=>[id,b.colour]));
    const pickupMaterial = createBoostMaterial();
    this.materials.add(pickupMaterial);
    for (const type of Object.keys(this.pickupColours)) {
      const geometry=createBoostGeometry(type);this.pickups[type]=this.batch(geometry,pickupMaterial,40,!mobile);
      const aura=createBoostAuraGeometry(type,geometry);
      if(aura){this.pickupAuras[type]=this.batch(aura,createBoostAuraMaterial(),40,false);this.pickupAuras[type].renderOrder=2;}
    }
    // Keep the former public heal batch alias for any existing preview code.
    this.heals = this.pickups.heal;
    const pickupRingGeo = new THREE.RingGeometry(.405, .435, 32); pickupRingGeo.rotateX(-Math.PI / 2);
    const pickupBaseGeo = new THREE.CircleGeometry(.46, 28); pickupBaseGeo.rotateX(-Math.PI / 2);
    this.pickupRings = this.batch(pickupRingGeo, basic('#ffffff', { transparent: true, opacity: .30, depthWrite: false, toneMapped: false }), LIMITS.drops);
    this.pickupBases = this.batch(pickupBaseGeo, basic('#152535', { transparent: true, opacity: .18, depthWrite: false }), LIMITS.drops);
    this.playerProjectiles = this.batch(new THREE.SphereGeometry(1, 8, 6), basic('#80d8ff', {toneMapped:false}), LIMITS.projectiles);
    this.playerProjectileCores = this.batch(new THREE.SphereGeometry(1, 8, 6), basic('#eaffff', {toneMapped:false}), LIMITS.projectiles);
    const arrow = shapeBuilder();
    arrow.add('box', '#9b7443', [0, 0, -.03], [.035, .035, .64]);
    arrow.add('cone', '#d8edf0', [0, 0, .35], [.10, .19, .10], [Math.PI / 2, 0, 0]);
    arrow.add('box', '#fff2cc', [0, 0, -.27], [.16, .025, .15]);
    arrow.add('box', '#ecdfbb', [0, 0, -.27], [.025, .16, .15]);
    this.arrows = this.batch(arrow.finish(), standard('#ffffff', { vertexColors: true }), LIMITS.projectiles);
    this.snowballs=this.batch(createExtraProjectileGeometry('snowball'),standard('#ffffff',{vertexColors:true,roughness:.8}),LIMITS.projectiles);
    this.tridents=this.batch(createExtraProjectileGeometry('trident'),standard('#ffffff',{vertexColors:true,roughness:.6,metalness:.25}),LIMITS.projectiles);
    this.witherSkullRenderer=createWitherSkullBatch(this.group,{capacity:LIMITS.projectiles,mobile});
    this.witherSkulls=this.witherSkullRenderer.mesh;
    const ember=shapeBuilder();ember.add('ball','#ff7b20',[0,0,0],[.7,.7,.85]);ember.add('cone','#ff3d08',[0,0,-.65],[.48,1.3,.48],[-Math.PI/2,0,0]);
    this.embers=this.batch(ember.finish(),standard('#ffffff',{vertexColors:true,emissive:'#ff4c07',emissiveIntensity:1.1,roughness:.4}),LIMITS.projectiles);
    this.emberCores=this.batch(new THREE.IcosahedronGeometry(1,0),basic('#fff0b0',{toneMapped:false}),LIMITS.projectiles);
    const bottle=shapeBuilder();bottle.add('cylinder','#9160bf',[0,0,0],[.30,.35,.30]);bottle.add('cylinder','#bce0ed',[0,.21,0],[.13,.14,.13]);bottle.add('cylinder','#b88a5d',[0,.30,0],[.16,.075,.16]);bottle.add('box','#efffff',[-.08,.025,.145],[.035,.14,.02]);
    this.potions=this.batch(bottle.finish(),standard('#ffffff',{vertexColors:true,roughness:.3}),LIMITS.projectiles);
    this.enemyProjectiles = this.batch(new THREE.IcosahedronGeometry(1, 1), standard('#ffffff', { emissive: '#ffffff', emissiveIntensity: .12 }), LIMITS.projectiles);
    this.enemyCores = this.batch(new THREE.IcosahedronGeometry(1, 0), basic('#ffffff'), LIMITS.projectiles);
    const warningDisk = new THREE.CircleGeometry(1, 48); warningDisk.rotateX(-Math.PI / 2);
    const warningRing = new THREE.RingGeometry(.96, 1, 48); warningRing.rotateX(-Math.PI / 2);
    const fillingDisk = new THREE.CircleGeometry(1, 48); fillingDisk.rotateX(-Math.PI / 2);
    this.warningAreas = this.batch(warningDisk, basic('#ffffff', { transparent: true, opacity: .17, depthWrite: false, side: THREE.DoubleSide }), LIMITS.warnings);
    this.warningRings = this.batch(warningRing, basic('#ffffff', { transparent: true, opacity: .95, depthWrite: false, side: THREE.DoubleSide }), LIMITS.warnings*2);
    this.warningFills = this.batch(fillingDisk, basic('#ffffff', { transparent: true, opacity: .23, depthWrite: false, side: THREE.DoubleSide }), LIMITS.warnings);
    const warningIcon = shapeBuilder();
    warningIcon.add('box', '#fff0bc', [0, 0, -.10], [.075, .035, .30]);
    warningIcon.add('box', '#fff0bc', [0, 0, .16], [.085, .035, .085]);
    this.warningIcons = this.batch(warningIcon.finish(), skinMaterial, LIMITS.warnings);
    this.warningPaths=this.batch(new THREE.BoxGeometry(1,1,1),basic('#ffffff',{transparent:true,opacity:.24,depthWrite:false}),LIMITS.warnings);
    this.warningPathFills=this.batch(new THREE.BoxGeometry(1,1,1),basic('#ffffff',{transparent:true,opacity:.3,depthWrite:false}),LIMITS.warnings);
    this.warningPathEdges=this.batch(new THREE.BoxGeometry(1,1,1),basic('#ffffff',{transparent:true,opacity:.9,depthWrite:false}),LIMITS.warnings*2);
    const annulusBatch=opacity=>{
      const geometry=new THREE.RingGeometry(1,1,64);geometry.rotateX(-Math.PI/2);
      geometry.setAttribute('ringEdge',new THREE.Float32BufferAttribute(Array.from({length:geometry.attributes.position.count},(_,i)=>i<65?0:1),1));
      geometry.setAttribute('instanceInnerRatio',new THREE.InstancedBufferAttribute(new Float32Array(LIMITS.warnings),1));
      const material=basic('#ffffff',{transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide});
      material.onBeforeCompile=shader=>{shader.vertexShader='attribute float ringEdge;\nattribute float instanceInnerRatio;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.xz *= mix(instanceInnerRatio, 1.0, ringEdge);');};
      material.customProgramCacheKey=()=> 'survival-warning-annulus-v1';
      return this.batch(geometry,material,LIMITS.warnings);
    };
    this.warningAnnuli=annulusBatch(.17);this.warningAnnulusFills=annulusBatch(.23);
    this.burning = this.batch(new THREE.IcosahedronGeometry(1, 0), basic('#ffb852', { transparent: true, opacity: .8 }), LIMITS.enemies);
  }

  batch(geometry, material, count, castShadow = false) {
    const m = new THREE.InstancedMesh(geometry, material, count);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.count = 0;
    // The arena is small; skipping per-frame bounds work is cheaper than
    // accidentally culling an instanced horde using its first frame's bounds.
    m.frustumCulled = false;
    m.castShadow = castShadow;
    m.receiveShadow = false;
    this.group.add(m);
    this.meshes.push(m);
    return m;
  }

  put(mesh, index, x, y, z, sx = 1, sy = sx, sz = sx, ry = 0, rx = 0, rz = 0) {
    this._dummy.position.set(x, y, z);
    this._dummy.rotation.set(rx, ry, rz);
    this._dummy.scale.set(sx, sy, sz);
    this._dummy.updateMatrix();
    mesh.setMatrixAt(index, this._dummy.matrix);
  }

  limb(mesh, index, x, y, z, rx, rz = 0) {
    this._child.compose(this._position.set(x, y, z), this._q.setFromEuler(this._e.set(rx, 0, rz)), UNIT_SCALE);
    this._composed.multiplyMatrices(this._root, this._child);
    mesh.setMatrixAt(index, this._composed);
  }

  update({ enemies = [], projectiles = [], drops = [], warnings = [], map='frontier' }, time = 0, dt = 0) {
    const cubic=map==='cubic';this.cubicMobs.update(cubic?enemies:[],time);
    for(const m of Object.values(this.models))for(const mesh of [m.bodyMesh,m.armMesh,m.legMesh])mesh.visible=!cubic;
    for (const model of Object.values(this.models)) model.count = 0;
    let shadows = 0, healthBars = 0, flames = 0;
    for (const enemy of enemies) {
      if (enemy.hp <= 0 || enemy.alive === false) continue;
      const type = this.models[enemy.type] ? enemy.type : 'walker';
      const m = this.models[type];
      const cap = type === 'boss' ? 2 : LIMITS.enemies;
      if (m.count >= cap) continue;
      const i = m.count++, boss = type === 'boss', runner = type === 'runner';
      const phase = time * (runner ? 12 : boss ? 4.4 : 6.1) + Number(enemy.id || 0) * 1.713;
      const stride = Math.sin(phase) * (runner ? .72 : boss ? .28 : .38);
      const windup = boss && warnings.some(w => Math.hypot(w.x - enemy.x, w.z - enemy.z) < 1.5);
      const bob = Math.abs(Math.sin(phase)) * (runner ? .055 : .025);
      const size = m.scale;
      this._root.compose(this._position.set(enemy.x, bob, enemy.z), this._q.setFromAxisAngle(UP, Number.isFinite(enemy.angle) ? enemy.angle : 0), this._scale.setScalar(size));
      m.bodyMesh.setMatrixAt(i, this._root);
      this.limb(m.armMesh, i * 2, -m.shoulder, 1.17, 0, windup ? -2.25 : -.75 - stride * .48, -.09);
      this.limb(m.armMesh, i * 2 + 1, m.shoulder, 1.17, 0, windup ? -2.25 : -.75 + stride * .48, .09);
      this.limb(m.legMesh, i * 2, -m.hip, .64, 0, stride);
      this.limb(m.legMesh, i * 2 + 1, m.hip, .64, 0, -stride);
      const flashing = Number(enemy.flash || 0) > 0;
      this._tint.setRGB(flashing ? 1.65 : 1, flashing ? 1.35 : 1, flashing ? 1.05 : 1);
      m.bodyMesh.setColorAt(i, this._tint);
      m.armMesh.setColorAt(i * 2, this._tint); m.armMesh.setColorAt(i * 2 + 1, this._tint);
      m.legMesh.setColorAt(i * 2, this._tint); m.legMesh.setColorAt(i * 2 + 1, this._tint);
      if (shadows < LIMITS.enemies + 2) {
        const spec=this.cubicMobs.types[enemy.bossVariant||enemy.variant||enemy.type];const spread=(spec?.shadowScale||(boss?2.2:runner?(enemy.variant==='cave-spider'?.56:.8):1))*(enemy.modelScale||1);
        this.put(this.shadows, shadows++, enemy.x, .012, enemy.z, spread, 1, boss?spread*.82:1);
      }
      if (healthBars < LIMITS.enemies + 2 && (boss || flashing || enemy.hp < enemy.maxHp)) {
        const w = boss ? 1.5 : .64, ratio = Math.max(0, Math.min(1, enemy.hp / (enemy.maxHp || 1)));
        const spec=cubic?this.cubicMobs.types[enemy.bossVariant||enemy.variant||enemy.type]:null;const barHeight=(spec?.healthHeight||(boss?3.5:cubic&&runner?(enemy.variant==='cave-spider'?.72:.98):2.1))*(enemy.modelScale||1);
        this.put(this.hpBackground, healthBars, enemy.x, barHeight, enemy.z, w, .075, .055);
        this.put(this.hpForeground, healthBars, enemy.x - w * (1 - ratio) / 2, barHeight, enemy.z + .012, w * ratio, .045, .065);
        this._tint.set(enemy.bossVariant==='wither'?'#c6b0e9':['warden','elder-guardian'].includes(enemy.bossVariant)?'#91dfff':boss?'#ff7964':'#b1e485'); this.hpForeground.setColorAt(healthBars, this._tint);
        healthBars++;
      }
      if (flames < LIMITS.enemies && Number(enemy.burn || enemy.burnTime || 0) > 0) {
        this.put(this.burning, flames++, enemy.x, .25 + Math.abs(Math.sin(time * 13)) * .18, enemy.z, .25, .50, .25, time * 4);
      }
    }
    for (const m of Object.values(this.models)) {
      m.bodyMesh.count = m.count; m.armMesh.count = m.count * 2; m.legMesh.count = m.count * 2;
    }
    this.shadows.count = shadows; this.hpBackground.count = this.hpForeground.count = healthBars; this.burning.count = flames;
    let gems = 0, bonuses = 0;
    const pickupCounts = Object.fromEntries(Object.keys(this.pickups).map(type => [type, 0]));
    for (const drop of drops) {
      const id = Number(drop.id || 0), type = drop.type || 'xp';
      const ttl = Number.isFinite(drop.life) ? drop.life : Number.isFinite(drop.ttl) ? drop.ttl : Number.isFinite(drop.remaining) ? drop.remaining : Infinity;
      // A last-second blink communicates that a bonus will disappear soon.
      if (type !== 'xp' && ttl < 4 && Math.sin(time * 13 + id) < -.30) continue;
      if (this.pickups[type]) {
        const count = pickupCounts[type];
        if (count >= 40 || bonuses >= LIMITS.drops) continue;
        const bob = this.reducedMotion ? 0 : Math.sin(time * 2.2 + id) * .045;
        this._dummy.position.set(drop.x, .76 + bob, drop.z);
        // Physical world objects have stable poses; small yaw reveals their
        // real volume without hiding their lid, laces, arrowheads or poles.
        const pose=BOOST_POSES[type];
        this._dummy.rotation.set(0,pose.yaw+(this.reducedMotion?0:Math.sin(time*.75+id)*.10),this.reducedMotion?0:Math.sin(time*1.1+id)*.025);
        this._dummy.scale.setScalar(1);
        this._dummy.updateMatrix();
        this.pickups[type].setMatrixAt(count, this._dummy.matrix);
        this.pickupAuras[type]?.setMatrixAt(count,this._dummy.matrix);
        const pulse = this.reducedMotion ? 1 : 1 + Math.sin(time * 2.2 + id) * .025;
        this.put(this.pickupRings, bonuses, drop.x, .024, drop.z, pulse, 1, pulse);
        this.put(this.pickupBases, bonuses, drop.x, .017, drop.z, 1, 1, .68);
        this._tint.set(this.pickupColours[type]); this.pickupRings.setColorAt(bonuses, this._tint);
        pickupCounts[type]++; bonuses++;
      } else if (gems < LIMITS.drops) {
        const value = Number(drop.value || 1), scale = value >= 10 ? 1.45 : value >= 6 ? 1.28 : 1.05;
        const y = .39 + Math.sin(time * 3.2 + id) * .055, yaw = time * 1.35 + id;
        this.put(this.gems, gems, drop.x, y, drop.z, scale, scale, scale, yaw);
        this.put(this.gemShines, gems, drop.x, y, drop.z, scale, scale, scale, yaw);
        this.put(this.gemGlows, gems, drop.x, .022, drop.z, scale, 1, scale);
        this.put(this.gemBases, gems, drop.x, .014, drop.z, scale, 1, scale);
        this._tint.set(value >= 10 ? '#b6b1ff' : value >= 6 ? '#8ee6ff' : '#ffffff');this.gems.setColorAt(gems, this._tint);
        this._tint.set(value >= 10 ? '#b7a2ff' : '#42d2ff');this.gemGlows.setColorAt(gems, this._tint);
        gems++;
      }
    }
    this.gems.count = this.gemGlows.count = this.gemBases.count = this.gemShines.count = gems;
    this.pickupRings.count = this.pickupBases.count = bonuses;
    for (const [type, count] of Object.entries(pickupCounts)) this.pickups[type].count = count;
    for (const [type,mesh]of Object.entries(this.pickupAuras))mesh.count=pickupCounts[type]||0;
    this.witherSkullRenderer.update(projectiles);
    let playerPellets = 0, enemyPellets = 0, arrows = 0,potions=0,embers=0,snowballs=0,tridents=0;
    for (const p of projectiles) {
      if (p.life <= 0) continue;
      const angle = Math.atan2(p.vx || 0, p.vz || 0);
      if(p.kind==='wither-skull'){
        continue;
      }else if(p.kind==='snowball'){
        if(snowballs>=LIMITS.projectiles)continue;this.put(this.snowballs,snowballs++,p.x,Number.isFinite(p.y)?p.y:.9,p.z,1,1,1,angle,time*4);
      }else if(p.kind==='trident'){
        if(tridents>=LIMITS.projectiles)continue;this.put(this.tridents,tridents++,p.x,Number.isFinite(p.y)?p.y:.9,p.z,1,1,1,angle);
      }else if(p.kind==='ember'){
        if(embers>=LIMITS.projectiles)continue;const r=Math.max(.07,p.radius||.13),y=Number.isFinite(p.y)?p.y:.75;
        this.put(this.embers,embers,p.x,y,p.z,r*2,r*2,r*2.8,angle,0,time*7);this._tint.set(p.colour||'#ffffff');this.embers.setColorAt(embers,this._tint);
        this.put(this.emberCores,embers++,p.x,y,p.z,r*.7,r*.7,r*1.2,angle);
      }else if(p.kind==='potion'){
        if(potions>=LIMITS.projectiles)continue;
        this.put(this.potions,potions++,p.x,p.y||1,p.z,1,1,1,angle,time*5,time*3);
      }else if (p.kind==='arrow'||p.kind==='bolt'){
        if(arrows>=LIMITS.projectiles)continue;const bolt=p.kind==='bolt';this.put(this.arrows,arrows,p.x,Number.isFinite(p.y)?p.y:.90,p.z,bolt?1.25:1,bolt?1.25:1,bolt?.82:1,angle);this._tint.set(p.colour||(p.effect==='slow'?'#8ce3ff':bolt?'#b5aca2':p.team==='enemy'?'#ffb38c':p.burn>0?'#ffc477':'#ffffff'));this.arrows.setColorAt(arrows,this._tint);arrows++;
      } else if (p.team === 'enemy') {
        if (enemyPellets >= LIMITS.projectiles) continue;
        const radius = p.radius || .16;
        const colour=p.colour||(p.kind==='fireball'?'#ff9c45':p.kind==='dragon-fireball'?'#b58be9':p.kind==='wind'?'#b7eaff':'#99d66d'),y=p.y||.82;
        this.put(this.enemyProjectiles, enemyPellets, p.x, y, p.z, radius, radius, radius * 1.3, angle, time * 8);this._tint.set(colour);this.enemyProjectiles.setColorAt(enemyPellets,this._tint);
        this.put(this.enemyCores, enemyPellets, p.x, y+.02, p.z, radius * .60, radius * .60, radius * .72, angle, -time * 7);this._tint.setRGB(this._tint.r*.45+.55,this._tint.g*.45+.55,this._tint.b*.45+.55);this.enemyCores.setColorAt(enemyPellets,this._tint);
        enemyPellets++;
      } else {
        if (playerPellets >= LIMITS.projectiles) continue;
        const superShot = p.super || p.damage >= 40;
        this.put(this.playerProjectiles, playerPellets, p.x, .70, p.z, superShot ? .11 : .075, superShot ? .11 : .075, superShot ? .36 : .25, angle);
        this.put(this.playerProjectileCores, playerPellets++, p.x, .76, p.z, .036, .036, .19, angle);
      }
    }
    this.playerProjectiles.count = this.playerProjectileCores.count = playerPellets; this.arrows.count = arrows;this.potions.count=potions;this.embers.count=this.emberCores.count=embers; this.snowballs.count=snowballs;this.tridents.count=tridents;this.enemyProjectiles.count = this.enemyCores.count = enemyPellets;
    let warningCount = 0,circles=0,rings=0,annuli=0,paths=0,edges=0,icons=0;
    for (const w of warnings) {
      if (warningCount >= LIMITS.warnings || w.remaining <= 0) continue;
      const progress = w.active||w.type==='zone'?1:Math.max(0, Math.min(1, 1 - w.remaining / (w.duration || 1.3)));
      const radius = Math.max(.2, w.radius || 1), fillRadius = radius * Math.max(.025, Math.sqrt(progress));
      const hazard=['sonic','guardian','frost'].includes(w.hazard)?['#74c6ea','#b9edff','#63b4e2']:w.hazard==='poison'?['#afcc51','#d7f58b','#98c545']:['wither','dragon'].includes(w.hazard)?['#9c81cf','#e0b2ff','#a060d9']:['#f26255','#ff8061','#ff523f'];
      if(w.colour)hazard[0]=hazard[2]=w.colour;
      let iconX=w.x,iconZ=w.z;
      const tint=(mesh,index,hex)=>{this._tint.set(hex);mesh.setColorAt(index,this._tint);};
      if(Number.isFinite(w.fromX)&&Number.isFinite(w.fromZ)&&(w.shape==='line'||w.type==='charge'||w.beam)){
        const dx=w.x-w.fromX,dz=w.z-w.fromZ,length=Math.hypot(dx,dz),angle=Math.atan2(dx,dz),width=Math.max(.05,w.width||(w.type==='charge'?1.8:.055));
        if(length>.01){
          const x=(w.x+w.fromX)/2,z=(w.z+w.fromZ)/2;
          this.put(this.warningPaths,paths,x,.032,z,width,.018,length,angle);tint(this.warningPaths,paths,hazard[0]);
          const filled=Math.max(.025,progress);this.put(this.warningPathFills,paths,w.fromX+dx*filled/2,.041,w.fromZ+dz*filled/2,width,.018,length*filled,angle);tint(this.warningPathFills,paths++,hazard[2]);
          for(const side of[-1,1]){this.put(this.warningPathEdges,edges,x+Math.cos(angle)*width*.5*side,.047,z-Math.sin(angle)*width*.5*side,.035,.022,length,angle);tint(this.warningPathEdges,edges++,hazard[1]);}
          iconX=x;iconZ=z;
        }
      }else if(w.shape==='ring'){
        const inner=Math.max(0,Math.min(radius-.01,Number(w.innerRadius)||0)),outerFill=inner+(radius-inner)*Math.max(.025,progress);
        this.put(this.warningAnnuli,annuli,w.x,.022,w.z,radius,1,radius);this.warningAnnuli.geometry.attributes.instanceInnerRatio.setX(annuli,inner/radius);tint(this.warningAnnuli,annuli,hazard[0]);
        this.put(this.warningAnnulusFills,annuli,w.x,.029,w.z,outerFill,1,outerFill);this.warningAnnulusFills.geometry.attributes.instanceInnerRatio.setX(annuli,inner/outerFill);tint(this.warningAnnulusFills,annuli++,hazard[2]);
        for(const edge of [radius,inner])if(edge>.001){this.put(this.warningRings,rings,w.x,.033,w.z,edge,1,edge);tint(this.warningRings,rings++,hazard[1]);}
        iconX=w.x+(inner+radius)/2;
      }else{
        this.put(this.warningAreas,circles,w.x,.022,w.z,radius,1,radius);tint(this.warningAreas,circles,hazard[0]);
        this.put(this.warningFills,circles,w.x,.029,w.z,fillRadius,1,fillRadius);tint(this.warningFills,circles++,hazard[2]);
        this.put(this.warningRings,rings,w.x,.027,w.z,radius,1,radius);tint(this.warningRings,rings++,hazard[1]);
      }
      const iconSize = 1 + Math.sin(time * 12) * .08;
      this.put(this.warningIcons,icons,iconX,.052,iconZ,iconSize,1,iconSize);tint(this.warningIcons,icons++,hazard[1]);
      warningCount++;
    }
    this.warningAreas.count=this.warningFills.count=circles;this.warningRings.count=rings;this.warningIcons.count=icons;
    this.warningAnnuli.count=this.warningAnnulusFills.count=annuli;this.warningAnnuli.geometry.attributes.instanceInnerRatio.needsUpdate=true;this.warningAnnulusFills.geometry.attributes.instanceInnerRatio.needsUpdate=true;
    this.warningPaths.count=this.warningPathFills.count=paths;this.warningPathEdges.count=edges;
    for (const mesh of this.meshes) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  dispose() {
    this.cubicMobs.dispose();
    this.witherSkullRenderer.dispose();
    const geometries = new Set();
    for (const mesh of this.meshes) geometries.add(mesh.geometry);
    for (const g of geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.scene.remove(this.group);
    this.group.clear();
    this.meshes.length = 0;
  }
}
