import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';

const origin = process.env.TEST_BASE_URL || 'http://127.0.0.1:5190';
const browser = await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']});
const results = [];
const cases = [
  {character:'steve',weapon:'wooden-sword',combo:'echo-wave',row:'combo-echo',width:1280,height:800},
  {character:'steve',weapon:'crossbow',combo:'fire-ricochet',row:'combo-fire',width:844,height:390},
  {character:'shelly',weapon:'wooden-sword',combo:'shrapnel-line',row:'combo-shrapnel',width:390,height:844},
];

async function gainLevel(page){
  await page.evaluate(() => {
    const {run} = window.__survivalTest;
    const {state} = run;
    state.drops.push({id:run._id(),type:'xp',value:state.xpNeeded-state.xp,x:state.player.x,z:state.player.z});
  });
  await page.locator('#upgrade-overlay').waitFor({state:'visible'});
}

async function equipPrerequisites(page, combo, full){
  await page.evaluate(async ({combo,full}) => {
    const {UPGRADE_COMBINATIONS} = await import('/game/upgrade-combinations.js');
    const {getUpgradeDefs} = await import('/game/survival-core.js');
    const {run} = window.__survivalTest;
    const {state} = run;
    run._spawnClock = 1e6;
    state.level = Math.max(state.level,13);
    state.elapsed = Math.max(state.elapsed,410);
    state.nextBossAt = 420;
    state.enemies = [];
    state.drops = [];
    state.projectiles = [];
    state.warnings = [];
    const definitions = getUpgradeDefs(state.character,run.weaponId);
    for (const requirement of UPGRADE_COMBINATIONS[combo].requirements) {
      const target = full ? requirement.rank : requirement.rank - 1;
      while (state.upgrades[requirement.id] < target) {
        state.phase = 'upgrade';
        state.choices = [definitions.find(definition => definition.id === requirement.id)];
        if (!run.chooseUpgrade(requirement.id)) throw new Error(`Fixture could not apply ${requirement.id}`);
      }
    }
  }, {combo,full});
}

try {
  for (const scenario of cases) {
    const context = await browser.newContext({viewport:{width:scenario.width,height:scenario.height},deviceScaleFactor:1,hasTouch:scenario.width<1000,isMobile:scenario.width<1000});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {if(message.type()==='error')errors.push(message.text());});
    await page.addInitScript(({character,weapon}) => {
      localStorage.setItem('survival-character',character);
      localStorage.setItem('survival-map','cubic');
      localStorage.setItem('shelly-range-sound','off');
      localStorage.setItem('rift-survival-profile.v1',JSON.stringify({wallet:0,owned:['teal'],equipped:'teal',ownedWeapons:['wooden-sword',weapon],weapon,ownedSkills:['bow'],skill:'bow',effects:true}));
    }, scenario);
    try {
      await page.goto(`${origin}/survival.html`);
      await page.waitForFunction(() => document.body.dataset.ready === 'true' && window.__survivalTest?.effects.pixelEffects.ready, null, {timeout:45000});
      await page.locator('#start').click();
      await page.locator('[data-mode="endless"]').click();
      await page.locator('#launch-run').click();
      await equipPrerequisites(page,scenario.combo,false);
      await gainLevel(page);
      assert.equal(await page.locator(`[data-upgrade="${scenario.combo}"]`).count(),0);
      assert.equal(await page.locator('#combo-progress').isVisible(),true);
      assert.equal(await page.locator('#combo-progress .combo-ingredient').count(),2);
      await page.locator('.upgrade-choice').first().click();
      await page.locator('#upgrade-overlay').waitFor({state:'hidden'});
      await equipPrerequisites(page,scenario.combo,true);

      for (let rank=1; rank<=3; rank++) {
        await gainLevel(page);
        const card = page.locator(`.upgrade-choice[data-combination="${scenario.combo}"]`);
        assert.equal(await card.count(),1);
        assert.equal(await card.locator('.upgrade-stars img').count(),3);
        assert.equal(await card.locator('.upgrade-stars .earned').count(),rank-1);
        assert.equal(await card.locator('.upgrade-stars .next').count(),1);
        assert.equal(await card.locator('.combo-ingredient[data-complete="true"]').count(),rank===1?2:0);
        assert.equal(await page.locator('#combo-progress').isVisible(),false);
        const image = await card.locator('.upgrade-icon img').evaluate(async img => {await img.decode();return {width:img.naturalWidth,src:img.currentSrc};});
        assert.equal(image.width,640);
        assert.ok(image.src.includes(`${scenario.combo}.webp`));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth),scenario.width);
        if (rank===1) {
          await page.evaluate(async () => {
            await document.fonts.ready;
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          });
          await page.screenshot({path:`game/artifacts/combo-${scenario.combo}-${scenario.width}.png`});
        }
        if (scenario.width<1000) await card.tap();
        else await card.click();
        await page.locator('#upgrade-overlay').waitFor({state:'hidden'});
        const chip = page.locator(`#build-items [data-combination="${scenario.combo}"]`);
        assert.equal(await chip.locator('b').textContent(),String(rank));
      }
      await gainLevel(page);
      assert.equal(await page.locator(`.upgrade-choice[data-combination="${scenario.combo}"]`).count(),0);
      await page.locator('.upgrade-choice').first().click();
      await page.locator('#upgrade-overlay').waitFor({state:'hidden'});

      // Verify main event routing in a staged late run. Trigger conditions and
      // exact combat damage are exercised separately in the core tests.
      await page.evaluate(({combo}) => {
        const {run} = window.__survivalTest;
        const {player} = run.state;
        run._event('comboproc',{combo,rank:3,x:player.x-2.1,z:player.z-1.7,radius:2.25,dx:.65,dz:-.76,range:3.4,spread:.13});
        run._event('frosthit',{x:player.x+1.3,z:player.z-3.2});
        run._event('bonus',{bonus:'heal',amount:15,x:player.x+2,z:player.z-1.6});
      }, scenario);
      await page.waitForFunction(row => {
        const {pixelEffects} = window.__survivalTest.effects;
        return [row,'frost','heal'].every(kind => pixelEffects.active.some(effect => effect.kind === kind));
      },scenario.row);
      assert.deepEqual(errors,[]);
      results.push({combo:scenario.combo,viewport:[scenario.width,scenario.height],passed:true});
      console.log(`PASS ${scenario.combo} at ${scenario.width}×${scenario.height}: lock, ranks, input, HUD, PixelFX`);
    } catch(error) {
      results.push({combo:scenario.combo,passed:false,error:error.stack,errors});
      await page.screenshot({path:`game/artifacts/combo-failure-${scenario.combo}.png`}).catch(()=>{});
      console.error(`FAIL ${scenario.combo}: ${error.message}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await writeFile('game/artifacts/combo-gameplay-results.json',JSON.stringify({results},null,2));
}
if (results.some(result => !result.passed)) process.exitCode=1;
