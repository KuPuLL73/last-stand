export class ArenaSound{
 constructor(){this.enabled=true;this.volume=1;this.ctx=null;this.master=null;this.noise=null;}
 unlock(){if(!this.ctx){const C=window.AudioContext||window.webkitAudioContext;if(!C)return;this.ctx=new C();this.master=this.ctx.createGain();this.master.gain.value=.24*this.volume;this.master.connect(this.ctx.destination);this.noise=this.ctx.createBuffer(1,this.ctx.sampleRate,this.ctx.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;}if(this.enabled)this.ctx.resume().catch(()=>{});}
 pause(){this.ctx?.suspend().catch(()=>{});}
 setEnabled(v){this.enabled=v;if(!v)this.pause();else this.unlock();}
 setVolume(value){if(Number.isFinite(value))this.volume=Math.max(0,Math.min(1,value));if(this.master)this.master.gain.value=.24*this.volume;return this.volume;}
 burst(duration,volume,frequency,type='lowpass'){if(!this.enabled||!this.ctx||this.ctx.state!=='running')return;const c=this.ctx,t=c.currentTime,source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=this.noise;filter.type=type;filter.frequency.value=frequency;gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.001,t+duration);source.connect(filter);filter.connect(gain);gain.connect(this.master);source.start(t);source.stop(t+duration);}
 tone(freq,duration,volume,slide=0){if(!this.enabled||!this.ctx||this.ctx.state!=='running')return;const c=this.ctx,t=c.currentTime,o=c.createOscillator(),g=c.createGain();o.type='triangle';o.frequency.setValueAtTime(freq,t);if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+duration);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+duration);}
 shoot(){this.burst(.22,.9,2300);this.tone(125,.18,.8,38);}
 hit(){this.burst(.07,.25,1700);this.tone(280,.08,.15,160);}
 reload(){this.burst(.06,.13,3600,'highpass');}
 step(){this.burst(.07,.08,650);}
 destroy(){this.tone(600,.18,.24,980);}
}
