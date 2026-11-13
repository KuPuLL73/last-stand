import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5190';
const browser = await chromium.launch({args: ['--enable-webgl', '--ignore-gpu-blocklist']});
const page = await browser.newPage({viewport: {width: 1000, height: 700}, deviceScaleFactor: 1});
const errors = [];
const results = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text());
});

async function open(combo) {
  await page.goto(`${base}/game/artifacts/combo-effects-preview.html?combo=${combo}`);
  await page.waitForFunction(() => window.__comboEffects, null, {timeout: 25_000});
}

async function check(name, fn) {
  try {
    results.push({name, passed: true, observation: await fn()});
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({name, passed: false, error: error.message});
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

try {
  for (const combo of ['echo-wave', 'fire-ricochet', 'shrapnel-line']) {
    await check(`${combo} paints real atlas pixels with one added draw call`, async () => {
      await open(combo);
      const observation = await page.evaluate(() => {
        const fixture = window.__comboEffects;
        const {renderer, effects, event, baselineDraws, render} = fixture;
        const pixel = effects.pixelEffects;
        const context = renderer.getContext();
        const {drawingBufferWidth: width, drawingBufferHeight: height} = context;
        const activePixels = new Uint8Array(width * height * 4);
        const basePixels = new Uint8Array(activePixels.length);
        const count = pixel.mesh.count;
        render();
        const draws = renderer.info.render.calls - baselineDraws;
        context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, activePixels);
        pixel.mesh.count = 0;
        render();
        context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, basePixels);
        pixel.mesh.count = count;
        render();
        let changed = 0;
        for (let i = 0; i < basePixels.length; i += 4) {
          if (Math.abs(basePixels[i] - activePixels[i]) + Math.abs(basePixels[i+1] - activePixels[i+1]) +
            Math.abs(basePixels[i+2] - activePixels[i+2]) > 12) changed++;
        }
        const matrix = pixel.mesh.instanceMatrix.array;
        const fan = pixel.active.findIndex(effect => effect.kind === 'combo-shrapnel') * 16;
        const directionDot = event.dx === undefined ? 1 :
          (matrix[fan] * event.dx + matrix[fan+2] * event.dz) / (Math.hypot(matrix[fan], matrix[fan+2]) * Math.hypot(event.dx, event.dz));
        return {
          ready: pixel.ready, count, draws, changed, directionDot,
          depthTest: pixel.material.depthTest, depthWrite: pixel.material.depthWrite,
          oldParticles: effects.abilityParticles.length,
        };
      });
      assert.equal(observation.ready, true);
      assert.equal(observation.count, combo === 'echo-wave' ? 1 : 2);
      assert.equal(observation.draws, 1);
      assert.ok(observation.changed > 30, 'the atlas must visibly affect the framebuffer');
      assert.ok(observation.directionDot > .999);
      assert.equal(observation.depthTest, true);
      assert.equal(observation.depthWrite, false);
      assert.equal(observation.oldParticles, 0);
      await page.screenshot({path: `game/artifacts/pixel-effects-${combo}.png`});
      return observation;
    });
  }

  await check('Touch pool keeps high priority effects, deduplicates minor flashes and clears', async () => {
    await page.setViewportSize({width: 390, height: 720});
    await open('echo-wave');
    const observation = await page.evaluate(() => {
      const {effects, advance} = window.__comboEffects;
      const pixel = effects.pixelEffects;
      effects.clear();
      for (let i = 0; i < 6; i++) effects.pixel('impact', {x: 1, z: 2, priority: 0});
      const coalesced = pixel.active.length;
      for (let i = 0; i < pixel.capacity * 3; i++) effects.pixel('impact', {x: i, z: 1, priority: 0});
      const majorAccepted = effects.pixel('earth', {x: 0, z: 0, ground: true, priority: 3});
      for (let i = 0; i < pixel.capacity * 3; i++) effects.pixel('xp', {x: i, z: 0, priority: 0});
      advance(.05);
      const active = pixel.active.length;
      const instances = pixel.mesh.count;
      const majorVisible = pixel.active.some(effect => effect.kind === 'earth');
      const badData = effects.pixel('impact', {x: NaN, z: 0}) || effects.pixel('unknown', {x: 0, z: 0});
      effects.clear();
      return {coalesced, majorAccepted, majorVisible, active, instances, badData,
        capacity: pixel.capacity, remaining: pixel.mesh.count, returnedSlots: pixel.free.length};
    });
    assert.deepEqual(observation, {coalesced: 1, majorAccepted: true, majorVisible: true, active: 30, instances: 30,
      badData: false, capacity: 30, remaining: 0, returnedSlots: 30});
    return observation;
  });

  await check('Pause freezes sprite time and reduced motion keeps a stable atlas cell', async () => {
    const observation = await page.evaluate(() => {
      const {effects, advance} = window.__comboEffects;
      const pixel = effects.pixelEffects;
      effects.pixel('heal', {x: 0, z: 0, duration: .6, reducedMotion: true});
      advance(.04);
      const age = pixel.active[0].age;
      const frame = pixel.tiles.getX(0);
      const matrix = Array.from(pixel.mesh.instanceMatrix.array);
      effects.update(0);
      const paused = pixel.active[0].age === age && matrix.every((value, i) => value === pixel.mesh.instanceMatrix.array[i]);
      advance(.12);
      const staticCell = pixel.tiles.getX(0) === frame;
      advance(.3);
      const expired = pixel.mesh.count === 0;
      effects.dispose();
      return {paused, staticCell, expired, released: pixel.mesh.parent === null && pixel.disposed};
    });
    assert.deepEqual(observation, {paused: true, staticCell: true, expired: true, released: true});
    return observation;
  });

  await check('No browser, texture or shader errors', () => assert.deepEqual(errors, []));
} finally {
  await browser.close();
  await writeFile('game/artifacts/pixel-effects-browser-results.json', JSON.stringify({results, errors}, null, 2));
}

if (results.some(result => !result.passed)) process.exitCode = 1;
