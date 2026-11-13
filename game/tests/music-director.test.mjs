import test from 'node:test';
import assert from 'node:assert/strict';
import {MusicDirector} from '../music-director.js';
class FakeAudio{
 constructor(){this.paused=true;this.dataset={};this.currentTime=0;this.plays=[];}
 setAttribute(){} removeAttribute(){this.src='';} load(){} remove(){}
 pause(){this.paused=true;}
 play(){return new Promise((resolve,reject)=>this.plays.push({resolve:()=>{this.paused=false;resolve();},reject}));}
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(t){
 const previous={Audio:globalThis.Audio,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
 globalThis.Audio=FakeAudio;globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
 const director=new MusicDirector();
 t.after(()=>{director.dispose();for(const[key,value]of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
 return{director,menu:director.lobby.audio,battle:director.battle.audio};
}
test('one gesture unlocks both channels but only the active scene requests playback',async t=>{
 const {director,menu,battle}=setup(t);director.sync({phase:'ready',enabled:true});assert.equal(menu.plays.length,0);director.unlock();assert.equal(menu.plays.length,1);assert.equal(battle.plays.length,0);
 menu.plays[0].resolve();await tick();director.sync({phase:'playing',enabled:true});assert.equal(menu.paused,true);assert.equal(battle.plays.length,1);battle.plays[0].resolve();await tick();assert.equal(battle.paused,false);
});
test('a late menu play promise cannot leak audio over an already started battle',async t=>{
 const {director,menu,battle}=setup(t);director.sync({phase:'ready',enabled:true});director.unlock();director.sync({phase:'playing',enabled:true});
 battle.plays[0].resolve();await tick();menu.plays[0].resolve();await tick();assert.equal(menu.paused,true);assert.equal(menu.volume,0);assert.equal(battle.paused,false);assert.equal(battle.plays.length,1);
});
test('upgrade keeps the battle loop, manual pause stops both and resume preserves offset',async t=>{
 const {director,menu,battle}=setup(t);director.sync({phase:'playing',enabled:true});director.unlock();battle.plays[0].resolve();await tick();battle.currentTime=37.25;
 director.sync({phase:'upgrade',enabled:true});assert.equal(battle.plays.length,1);assert.equal(battle.paused,false);director.sync({phase:'paused',enabled:true});assert.equal(menu.paused,true);assert.equal(battle.paused,true);
 director.sync({phase:'playing',enabled:true});assert.equal(battle.plays.length,2);assert.equal(battle.currentTime,37.25);
});
test('results, platform interruptions and mute cannot be undone by unlocking or moving volume',async t=>{
 const {director,menu,battle}=setup(t);director.unlock();
 for(const state of [{phase:'playing',enabled:true,paused:true},{phase:'playing',enabled:false},{phase:'dead',enabled:true},{phase:'won',enabled:true},{phase:'retired',enabled:true}]){
  director.sync(state);director.setVolume(.61);director.unlock();assert.equal(menu.plays.length,0);assert.equal(battle.plays.length,0);assert.equal(menu.paused,true);assert.equal(battle.paused,true);
 }
 assert.equal(director.lobby.volume,.61);assert.equal(director.battle.volume,.61);
});
test('returning to the lobby stops battle before its menu playback and uses unique media elements',async t=>{
 const {director,menu,battle}=setup(t);assert.equal(menu.id,'menu-music');assert.equal(battle.id,'battle-music');assert.notEqual(menu.src,battle.src);
 director.sync({phase:'playing',enabled:true});director.unlock();battle.plays[0].resolve();await tick();director.sync({phase:'ready',enabled:true});assert.equal(battle.paused,true);assert.equal(menu.plays.length,1);assert.equal(menu.volume,0);
});
