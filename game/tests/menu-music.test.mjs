import test from 'node:test';
import assert from 'node:assert/strict';
import {MenuMusic} from '../menu-music.js';
import {ArenaSound} from '../sound.js';

class FakeAudio {
 constructor(){this.paused=true;this.dataset={};this.currentTime=0;this.plays=[];this.pauseCalls=0;}
 setAttribute(){}
 removeAttribute(name){if(name==='src')this.src='';}
 remove(){this.removed=true;}
 load(){this.loaded=true;}
 pause(){this.paused=true;this.pauseCalls++;}
 play(){
  return new Promise((resolve,reject)=>this.plays.push({
   resolve:()=>{this.paused=false;resolve();},reject,
  }));
 }
}

function setup(t){
 const previous={Audio:globalThis.Audio,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
 let serial=0;const frames=new Map();
 globalThis.Audio=FakeAudio;
 globalThis.requestAnimationFrame=fn=>{const id=++serial;frames.set(id,fn);return id;};
 globalThis.cancelAnimationFrame=id=>frames.delete(id);
 const music=new MenuMusic({src:'/fixture/menu.mp3'});
 t.after(()=>{music.dispose();for(const[key,value]of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
 return {music,audio:music.audio,frames};
}
const menu={enabled:true,inMenu:true,paused:false};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('Menu track waits for a gesture; frame updates do not spawn duplicate playback',async t=>{
 const {music,audio,frames}=setup(t);
 music.setState(menu);assert.equal(audio.plays.length,0);assert.equal(audio.dataset.menuMusicState,'locked');
 music.unlock();for(let i=0;i<25;i++){music.setState(menu);music.unlock();}
 assert.equal(audio.plays.length,1);assert.equal(audio.loop,true);assert.equal(audio.preload,'none');
 audio.plays[0].resolve();await tick();
 assert.equal(audio.dataset.menuMusicState,'playing');assert.equal(frames.size,1);
 for(let i=0;i<25;i++){music.setState(menu);music.unlock();}
 assert.equal(audio.plays.length,1);assert.equal(frames.size,1,'already playing must not restart its fade');
});

test('Entering battle or its pause/result screen stops music and preserves its offset',async t=>{
 const {music,audio,frames}=setup(t);music.setState(menu);music.unlock();audio.plays[0].resolve();await tick();
 audio.currentTime=47.5;music.setState({...menu,inMenu:false});
 assert.equal(audio.paused,true);assert.equal(audio.volume,0);assert.equal(frames.size,0);assert.equal(audio.currentTime,47.5);
 music.unlock();for(let i=0;i<25;i++)music.setState({...menu,inMenu:false});
 assert.equal(audio.plays.length,1,'battle user gestures must not start the menu song');
 music.setState(menu);assert.equal(audio.plays.length,2);assert.equal(audio.currentTime,47.5);
});

test('A late play fulfillment after launching battle is silenced',async t=>{
 const {music,audio,frames}=setup(t);music.setState(menu);music.unlock();
 music.setState({...menu,inMenu:false});
 audio.plays[0].resolve();await tick();
 assert.equal(audio.paused,true);assert.equal(audio.volume,0);assert.equal(frames.size,0);assert.equal(audio.plays.length,1);
});

test('Quick exit and return waits out the stale play attempt before resuming once',async t=>{
 const {music,audio}=setup(t);music.setState(menu);music.unlock();
 music.setState({...menu,inMenu:false});music.setState(menu);
 assert.equal(audio.plays.length,1,'do not overlap pending play calls');
 audio.plays[0].resolve();await tick();assert.equal(audio.plays.length,2);
 audio.plays[1].resolve();await tick();assert.equal(audio.paused,false);assert.equal(audio.dataset.menuMusicState,'playing');
});

test('Muted or externally paused menu cannot restart from gestures',async t=>{
 const {music,audio}=setup(t);music.setState(menu);music.unlock();audio.plays[0].resolve();await tick();
 music.setState({...menu,enabled:false});music.unlock();assert.equal(audio.paused,true);assert.equal(audio.plays.length,1);
 music.setState({...menu,paused:true});music.unlock();assert.equal(audio.plays.length,1);
 music.setState(menu);assert.equal(audio.plays.length,2);
});

test('Autoplay rejection waits for the next gesture instead of retrying each UI update',async t=>{
 const {music,audio}=setup(t);music.setState(menu);music.unlock();
 const blocked=new Error('Gesture required');blocked.name='NotAllowedError';audio.plays[0].reject(blocked);await tick();
 assert.equal(audio.dataset.menuMusicState,'blocked');
 for(let i=0;i<25;i++)music.setState(menu);assert.equal(audio.plays.length,1);
 music.unlock();assert.equal(audio.plays.length,2);audio.plays[1].resolve();await tick();assert.equal(audio.dataset.menuMusicState,'playing');
});

test('Disposal during pending playback cannot leak music or restart later',async t=>{
 const {music,audio,frames}=setup(t);music.setState(menu);music.unlock();music.dispose();
 audio.plays[0].resolve();await tick();music.setState(menu);music.unlock();
 assert.equal(audio.paused,true);assert.equal(audio.volume,0);assert.equal(audio.src,'');assert.equal(audio.removed,true);
 assert.equal(audio.dataset.menuMusicState,'disposed');assert.equal(audio.plays.length,1);assert.equal(frames.size,0);
});

test('Music slider updates the running fade envelope and final live volume without restarting',async t=>{
 const {music,audio,frames}=setup(t);music.setState(menu);music.unlock();audio.plays[0].resolve();await tick();
 let [id,frame]=frames.entries().next().value;frames.delete(id);frame(performance.now()+300);
 const previousAmplitude=audio.volume;assert.ok(previousAmplitude>.12&&previousAmplitude<.22);
 music.setVolume(.6);assert.ok(Math.abs(audio.volume-previousAmplitude/.32*.6)<1e-10);
 [id,frame]=frames.entries().next().value;frames.delete(id);frame(performance.now()+1000);
 assert.equal(audio.volume,.6);assert.equal(frames.size,0);
 music.setVolume(.15);assert.equal(audio.volume,.15);assert.equal(audio.plays.length,1);assert.equal(audio.paused,false);
 music.setVolume(0);assert.equal(audio.volume,0);assert.equal(audio.paused,false,'volume zero keeps the same track position running silently');
 music.setVolume(.75);assert.equal(audio.volume,.75);assert.equal(audio.plays.length,1);
});

test('Music slider does not unlock, unmute, resume or revive a pending battle transition',async t=>{
 const {music,audio}=setup(t);music.setState(menu);music.setVolume(.5);assert.equal(audio.plays.length,0);assert.equal(audio.volume,0);
 music.unlock();music.setVolume(.7);assert.equal(audio.volume,0,'pending play stays at the beginning of the fade');
 music.setState({...menu,inMenu:false});music.setVolume(1);audio.plays[0].resolve();await tick();
 assert.equal(audio.volume,0);assert.equal(audio.paused,true);assert.equal(audio.plays.length,1);
 music.setState({...menu,enabled:false});music.setVolume(.8);
 assert.equal(music.enabled,false);assert.equal(audio.volume,0);assert.equal(audio.paused,true);assert.equal(audio.plays.length,1);
});

test('Both volume controls clamp finite values and keep a finite target on invalid input',t=>{
 const {music}=setup(t);const sound=new ArenaSound();
 for(const player of [music,sound]){
  assert.equal(player.setVolume(5),1);assert.equal(player.setVolume(-2),0);assert.equal(player.setVolume(.4),.4);
  for(const invalid of [NaN,Infinity,-Infinity,undefined,'bad',null])assert.equal(player.setVolume(invalid),.4);
  assert.equal(Number.isFinite(player.volume),true);
 }
});

test('SFX slider applies before unlock and to the existing master gain without enabling sound',t=>{
 const previous=globalThis.window;
 class FakeAudioContext {
  constructor(){this.sampleRate=8;this.state='suspended';this.destination={};this.resumeCalls=0;}
  createGain(){return {gain:{value:0},connect(){}};}
  createBuffer(){return {getChannelData:()=>new Float32Array(8)};}
  resume(){this.resumeCalls++;this.state='running';return Promise.resolve();}
  suspend(){this.state='suspended';return Promise.resolve();}
 }
 globalThis.window={AudioContext:FakeAudioContext};
 t.after(()=>{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;});
 const sound=new ArenaSound();sound.setVolume(.25);assert.equal(sound.ctx,null);sound.setEnabled(false);sound.unlock();
 assert.equal(sound.master.gain.value,.06);assert.equal(sound.ctx.state,'suspended');assert.equal(sound.ctx.resumeCalls,0);
 sound.setVolume(.5);assert.equal(sound.master.gain.value,.12);assert.equal(sound.enabled,false);assert.equal(sound.ctx.resumeCalls,0);
 sound.setEnabled(true);assert.equal(sound.ctx.resumeCalls,1);sound.setVolume(.75);
 assert.equal(sound.master.gain.value,.18);assert.equal(sound.ctx.resumeCalls,1,'volume changes must not resume the audio context');
 sound.setVolume(1);assert.equal(sound.master.gain.value,.24,'maximum stays at the original SFX master gain');
 sound.setEnabled(false);sound.setVolume(.1);assert.equal(sound.ctx.state,'suspended');assert.equal(sound.enabled,false);
});
