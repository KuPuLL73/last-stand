import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Box3,Vector3} from 'three';
import {EXTRA_WEAPONS} from '../extra-weapons.js';
import {getSteveWeapon} from '../steve-weapons.js';
import {createMinecraftItem,createSteve} from '../steve-model.js';
import {createExtraProjectileGeometry} from '../extra-projectiles.js';

test('extra items retain pinned unmodified source files and distinct control/precision roles',()=>{
 const sources=JSON.parse(readFileSync(new URL('../assets/extra-weapons/sources.json',import.meta.url)));
 for(const file of sources.items){const bytes=readFileSync(new URL(`../assets/extra-weapons/${file.file}`,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);}
 assert.deepEqual(EXTRA_WEAPONS.map(w=>w.id),['snow-caster','tide-trident']);
 const snow=getSteveWeapon('snow-caster'),trident=getSteveWeapon('tide-trident');
 assert.equal(snow.rangedKind,'snowball');assert.equal(snow.effect,'slow');assert.ok(snow.slowStrength>0&&snow.slowDuration>0);
 assert.equal(trident.rangedKind,'trident');assert.ok(trident.pierce>0);assert.ok(trident.damage>snow.damage&&trident.interval>snow.interval);
});

test('both held models use their real pixels and a throwing release returns after recovery',()=>{
 for(const[id,key]of [['snow-caster','snowball'],['tide-trident','thrown-trident']]){
  const item=createMinecraftItem(id);assert.equal(item.userData.itemPixelKey,key);assert.ok(item.children[0].geometry.attributes.position.count>100);
  item.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  const steve=createSteve({weapon:id});steve.update(0,{phase:'ready'});assert.equal(steve.root.userData.heldWeapon,id);assert.equal(steve.sword.visible,true);
  steve.attack({kind:'ranged',interval:getSteveWeapon(id).interval});steve.update(.10,{phase:'playing'});
  assert.equal(steve.root.userData.attackKind,'ranged');assert.equal(steve.root.userData.rangedActive,true);assert.equal(steve.sword.visible,false,'the released item must leave the hand briefly');
  steve.update(.8,{phase:'playing'});assert.equal(steve.sword.visible,true);
  steve.update(0,{phase:'playing',bowActive:true});assert.equal(steve.bow.visible,true);assert.equal(steve.sword.visible,false);
  steve.update(0,{phase:'playing',bowActive:false});assert.equal(steve.root.userData.heldWeapon,id);assert.equal(steve.sword.visible,true);
  const bounds=new Box3().setFromObject(steve.root),size=bounds.getSize(new Vector3());assert.ok(size.toArray().every(Number.isFinite));
  steve.dispose();
 }
});

test('projectiles have real finite coloured volume and the trident forward axis is +Z',()=>{
 for(const kind of ['snowball','trident']){
  const g=createExtraProjectileGeometry(kind),size=g.boundingBox.getSize(new Vector3());
  assert.ok(g.attributes.position.count>100);assert.equal(g.attributes.color.count,g.attributes.position.count);
  assert.ok(size.toArray().every(n=>Number.isFinite(n)&&n>0));
  if(kind==='trident'){assert.equal(g.userData.forwardAxis,'+Z');assert.ok(size.z>1&&size.z>size.x*2);}
  else assert.ok(size.x>.3&&size.y>.3&&size.z>.3);
  g.dispose();
 }
});
