import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {STEVE_WEAPONS,weaponStats} from '../steve-weapons.js';
import {STEVE_SKILLS,getSteveSkill} from '../steve-skills.js';
import {createSteve,createMinecraftItem} from '../steve-model.js';

test('Ranged loadouts keep separate firing identities and finite, distinct projectile stats',()=>{
 const ids=['hunting-bow','crossbow','ember-staff'];
 for(const id of ids){const w=weaponStats(id);assert.equal(w.attackMode,'ranged');assert.ok(w.range>8&&w.projectileSpeed>0&&w.projectileRadius>0);assert.ok(w.damage>0&&w.fireInterval>0);assert.notEqual(w.id,'wooden-sword');}
 assert.equal(weaponStats('crossbow').pierce,1);assert.equal(weaponStats('crossbow').penetrationFalloff,.72);
 assert.equal(weaponStats('ember-staff').burn,1);assert.ok(weaponStats('ember-staff').splashRadius>1);
 assert.equal(weaponStats('wooden-sword').attackMode,'melee');
 assert.equal(new Set(STEVE_WEAPONS.map(w=>w.id)).size,STEVE_WEAPONS.length);
});

test('Every new item uses the original source pixels and the cache matches its source hashes',()=>{
 const source=JSON.parse(readFileSync(new URL('../assets/steve-ranged/sources.json',import.meta.url)));
 for(const file of source.items){const bytes=readFileSync(new URL(`../assets/steve-ranged/${file.file}`,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);}
 for(const[id,key]of [['hunting-bow','bow'],['crossbow','crossbow-arrow'],['ember-staff','blaze-rod']]){
  const item=createMinecraftItem(id);assert.equal(item.userData.itemPixelKey,key);
  assert.ok(item.children[0].geometry.attributes.position.count>100);
 }
});

test('Permanent bow and crossbow remain real held ranged models without activating the bow skill',()=>{
 for(const id of ['hunting-bow','crossbow','ember-staff']){
  const steve=createSteve({weapon:id});
  steve.update(.1,{phase:'playing',bowActive:false});
  assert.equal(steve.root.userData.heldWeapon,id);assert.equal(steve.root.userData.rangedActive,true);assert.equal(steve.root.userData.bowActive,false);
  if(id==='hunting-bow'){assert.equal(steve.bow.visible,true);assert.equal(steve.sword.visible,false);assert.equal(steve.bow.children.filter(c=>c.visible).length,1);}
  else assert.equal(steve.sword.visible,true);
  steve.attack({kind:'ranged',interval:weaponStats(id).fireInterval});steve.update(.08,{phase:'playing'});
  assert.ok(steve.root.getObjectByName('RightArm').rotation.x<-.5);
  steve.dispose();
 }
});

test('Crossbow reload shows exactly one authentic frame and temporary bow returns to the selected weapon',()=>{
 const steve=createSteve({weapon:'crossbow'});
 steve.attack({kind:'ranged',interval:1.65});
 const frames=[];
 for(const dt of [.02,.3,.4,.5,.5]){steve.update(dt,{phase:'playing'});const visible=steve.sword.children.filter(c=>c.visible);assert.equal(visible.length,1);frames.push(visible[0].name);}
 assert.ok(new Set(frames).size>=4,'reload must progress through original loading textures');
 steve.update(0,{phase:'playing',bowActive:true});assert.equal(steve.bow.visible,true);assert.equal(steve.sword.visible,false);
 steve.update(0,{phase:'playing',bowActive:false});assert.equal(steve.sword.visible,true);assert.equal(steve.root.userData.heldWeapon,'crossbow');
 steve.dispose();
});

test('Permanent skills have stable prices and invalid ids fall back to the existing bow',()=>{
 assert.deepEqual(STEVE_SKILLS.map(s=>s.id),['bow','dash','bulwark']);
 assert.equal(getSteveSkill(undefined).id,'bow');assert.equal(getSteveSkill('not-a-skill').id,'bow');
 assert.equal(getSteveSkill('dash').distance,5);assert.equal(getSteveSkill('bulwark').duration,4);
 assert.equal(getSteveSkill('bow').price,0);assert.equal(getSteveSkill('dash').price,1100);assert.equal(getSteveSkill('bulwark').price,1700);
});
