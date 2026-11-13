import * as THREE from 'three';
import atlasUrl from './assets/effects/pixel-fx.png?url';
import {PIXEL_FX_COLUMNS, PIXEL_FX_ROWS, PIXEL_FX_TILE} from './pixel-fx-atlas.js';

const rowCount = Math.max(...Object.values(PIXEL_FX_ROWS)) + 1;
const sampleWidth = ((PIXEL_FX_TILE - 1) / PIXEL_FX_TILE).toFixed(8);
const texelInset = (0.5 / PIXEL_FX_TILE).toFixed(8);
const planeNormal = new THREE.Vector3(0, 0, 1);
const groundFacing = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
const identity = new THREE.Quaternion();
const farToNear = (a, b) => a.depth - b.depth;
const clamp = THREE.MathUtils.clamp;

function markUpdated(attribute, count) {
  attribute.clearUpdateRanges();
  attribute.addUpdateRange(0, count * attribute.itemSize);
  attribute.needsUpdate = true;
}

/** A pooled atlas for short world effects. All visible sprites share one draw call. */
export class PixelEffects {
  constructor(scene, {mobile = false} = {}) {
    this.capacity = mobile ? 30 : 56;
    this.active = [];
    this.free = Array.from({length: this.capacity}, () => ({}));
    this.disposed = false;
    this.dummy = new THREE.Object3D();
    this.spin = new THREE.Quaternion();
    this.viewFacing = new THREE.Quaternion();

    this.texture = new THREE.TextureLoader().load(atlasUrl);
    this.texture.name = 'PixelFX combat atlas';
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;

    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.tiles = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 2), 2).setUsage(THREE.DynamicDrawUsage);
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity), 1).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('pixelTile', this.tiles);
    this.geometry.setAttribute('pixelAlpha', this.alpha);

    this.material = new THREE.MeshBasicMaterial({
      map: this.texture, transparent: true, depthTest: true, depthWrite: false, alphaTest: .02, toneMapped: false,
    });
    this.material.onBeforeCompile = shader => {
      shader.vertexShader = `attribute vec2 pixelTile;\nattribute float pixelAlpha;\nvarying float vPixelAlpha;\n${shader.vertexShader}`
        .replace('#include <uv_vertex>', `#include <uv_vertex>
          vMapUv = (pixelTile + vMapUv * ${sampleWidth} + vec2(${texelInset})) / vec2(${PIXEL_FX_COLUMNS}.0, ${rowCount}.0);
          vPixelAlpha = pixelAlpha;`);
      shader.fragmentShader = `varying float vPixelAlpha;\n${shader.fragmentShader}`
        .replace('#include <alphatest_fragment>', 'diffuseColor.a *= vPixelAlpha;\n#include <alphatest_fragment>');
    };
    this.material.customProgramCacheKey = () => `world-pixelfx-${PIXEL_FX_COLUMNS}-${rowCount}-${PIXEL_FX_TILE}`;

    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.capacity);
    this.mesh.name = 'World PixelFX · one atlas batch';
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Transparent hazard markers and shields are drawn over the decorative sprites.
    this.mesh.renderOrder = -1;
    scene.add(this.mesh);
  }

  get ready() {
    const image = this.texture.image;
    return !this.disposed && image?.width === PIXEL_FX_COLUMNS * PIXEL_FX_TILE && image?.height === rowCount * PIXEL_FX_TILE;
  }

  emit(kind, options = {}) {
    if (!this.ready || !Object.hasOwn(PIXEL_FX_ROWS, kind)) return false;
    const {x, z, ground = false, y = ground ? .07 : .9, size = 2, width = size, height = size,
      duration = .4, rotation = 0, priority = 1, opacity = 1, reducedMotion = false} = options;
    if (![x, y, z, width, height, duration, rotation, priority, opacity].every(Number.isFinite) ||
      width <= 0 || height <= 0 || duration <= 0 || opacity <= 0) return false;

    if (priority === 0 && this.active.some(effect =>
      effect.kind === kind && effect.age < .075 && (effect.x - x) ** 2 + (effect.z - z) ** 2 < .16)) return true;

    let effect = this.free.pop();
    if (effect) {
      this.active.push(effect);
    } else {
      // A flood of small impacts cannot push a boss telegraph accent or combo off screen.
      for (const candidate of this.active) {
        if (candidate.priority > priority) continue;
        if (!effect || candidate.priority < effect.priority ||
          (candidate.priority === effect.priority && candidate.duration - candidate.age < effect.duration - effect.age)) effect = candidate;
      }
      if (!effect) return false;
    }

    Object.assign(effect, {
      kind, x, y, z, ground, rotation, priority, reducedMotion,
      width: clamp(width, .04, 24), height: clamp(height, .04, 24),
      duration: clamp(reducedMotion ? Math.min(duration, .3) : duration, .05, 3),
      opacity: Math.min(opacity, 1), age: 0, depth: 0, fresh: true,
      row: rowCount - 1 - PIXEL_FX_ROWS[kind],
    });
    return true;
  }

  update(dt, camera) {
    if (this.disposed || !Number.isFinite(dt) || dt <= 0 || !this.active.length) return;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const effect = this.active[i];
      // Spawn events are consumed after simulation. Paint one onset frame before aging them.
      if (effect.fresh) effect.fresh = false;
      else effect.age += dt;
      if (effect.age < effect.duration) continue;
      this.active[i] = this.active.at(-1);
      this.active.pop();
      this.free.push(effect);
    }

    if (camera) {
      camera.getWorldQuaternion(this.viewFacing);
      const view = camera.matrixWorldInverse.elements;
      for (const effect of this.active) effect.depth = view[2] * effect.x + view[6] * effect.y + view[10] * effect.z + view[14];
      this.active.sort(farToNear);
    } else {
      this.viewFacing.copy(identity);
    }

    const dummy = this.dummy;
    for (let i = 0; i < this.active.length; i++) {
      const effect = this.active[i];
      const progress = effect.age / effect.duration;
      const frame = effect.reducedMotion ? Math.floor(PIXEL_FX_COLUMNS * .32) :
        Math.min(PIXEL_FX_COLUMNS - 1, 1 + Math.floor(progress * (PIXEL_FX_COLUMNS - 1)));
      const fade = 1 - clamp((progress - .76) / .24, 0, 1);
      dummy.position.set(effect.x, effect.y, effect.z);
      dummy.scale.set(effect.width, effect.height, 1);
      this.spin.setFromAxisAngle(planeNormal, effect.rotation - (effect.ground ? Math.PI / 2 : 0));
      dummy.quaternion.copy(effect.ground ? groundFacing : this.viewFacing).multiply(this.spin);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
      this.tiles.setXY(i, frame, effect.row);
      this.alpha.setX(i, effect.opacity * fade * (effect.reducedMotion ? .72 : 1));
    }

    this.mesh.count = this.active.length;
    if (this.mesh.count) {
      markUpdated(this.mesh.instanceMatrix, this.mesh.count);
      markUpdated(this.tiles, this.mesh.count);
      markUpdated(this.alpha, this.mesh.count);
    }
  }

  clear() {
    this.free.push(...this.active);
    this.active.length = 0;
    this.mesh.count = 0;
  }

  dispose() {
    if (this.disposed) return;
    this.clear();
    this.disposed = true;
    this.mesh.removeFromParent();
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
