import {hex} from './vendor/pixelfx/src/core/color.js';
import {clamp, ease, noise, rand, TAU} from './vendor/pixelfx/src/core/math.js';
import {ngon} from './vendor/pixelfx/src/core/shapes.js';
import {band, crystal, flare, sparkle} from './vendor/pixelfx/src/core/sim.js';

// Each design is sampled over a normalized lifetime. PixelFX's painter and
// ordered dithering keep the silhouette crisp, including on a light arena.
const palette = (dark, mid, bright, hot) => [dark, mid, bright, hot].map(hex);
const mint = palette('#184557', '#19948c', '#67eac7', '#dcfff0');
const gold = palette('#792e25', '#ed7438', '#ffc462', '#fff7cd');
const ice = palette('#263a72', '#478fd8', '#98ddff', '#effdff');
const violet = palette('#352451', '#7845b2', '#d38bfa', '#fae2ff');
const nature = palette('#294735', '#538f43', '#ace66b', '#f0ffc5');
const ash = palette('#2d2834', '#5d4d49', '#a98e74', '#e8d4a5');
const ember = palette('#732b43', '#d8494e', '#ff983f', '#fff29c');
const A = (t, start = .2) => 1 - ease.inQuad(clamp((t - start) / (1 - start)));

function diamond(p, x, y, r, C, alpha = 1) {
  if (r < .8) return;
  const h = r * 1.24;
  p.poly([[x,y-h],[x+r,y],[x,y+h],[x-r,y]], C[0], alpha);
  p.tri(x-r+1,y, x,y-h+1, x,y+h-1, C[2], alpha);
  p.tri(x+r-1,y, x,y-h+1, x,y+h-1, C[1], alpha);
  p.line(x-r+1,y, x,y-h+1, C[3], alpha);
}

function chips(p, t, C, {count = 9, radius = 23, seed = 1, angle = 0, spread = TAU, x = 0, y = 0, lift = 0, start = 0, size = 2.7, trail = false} = {}) {
  for (let i = 0; i < count; i++) {
    const age = clamp((t - start - rand(i,seed,9) * .13) / (1 - start));
    if (age === 0) continue;
    const direction = angle + ((i + rand(i,seed,4)) / count - .5) * spread;
    const distance = radius * (.42 + rand(i,seed,2) * .55) * ease.outCubic(age);
    const dx = Math.cos(direction), dy = Math.sin(direction);
    const px = x + dx * distance, py = y + dy * distance - lift * age;
    const width = Math.max(1, Math.round(size * (.5 + rand(i,seed,6) * .65) * (1 - age * .75)));
    const c = age < .32 ? C[3] : age < .65 ? C[2] : C[1];
    const opacity = A(age, .13) * A(t, .45);
    if (trail) p.line(px-dx*5*(1-age),py-dy*5*(1-age),px,py,C[1],opacity);
    p.rect(px,py,width,width,c,opacity);
    if (width >= 2) p.px(px,py,C[3]);
  }
}

function flash(p, t, C, strength = 10, x = 0, y = 0) {
  if (t > .42) return;
  const k = 1 - t / .42;
  flare(p, x, y, strength * k, k, C);
  p.glow(x, y, strength * .9, C[1], .19 * k);
}

function wave(p, radius, thickness, C, opacity = 1, {centre = [0,0], keep, squash = 1, hot = false} = {}) {
  band(p, centre[0], centre[1], radius, squash, thickness, opacity, C, keep, hot);
}

function streak(p, x, y, length, halfWidth, angle, C, opacity) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const tail = [x-dx*length,y-dy*length];
  const left = [x-dy*halfWidth,y+dx*halfWidth];
  const right = [x+dy*halfWidth,y-dx*halfWidth];
  const tip = [x+dx*halfWidth*1.35,y+dy*halfWidth*1.35];
  p.poly([tail,left,tip,right], C[0], opacity);
  p.poly([[x-dx*length*.78,y-dy*length*.78],left,tip,[x,y]], C[1], opacity);
  p.poly([[x-dx*length*.58,y-dy*length*.58],[x-dy*halfWidth*.48,y+dx*halfWidth*.48],tip,[x,y]], C[2], opacity);
  p.line(x-dx*length*.25,y-dy*length*.25,tip[0],tip[1],C[3],opacity);
}

function flame(p, x, y, h, w, lean, t, C, seed, opacity = 1) {
  if (h < 1) return;
  // Sculpt jagged layers into a tongue. The wick bends faster than the base.
  const bend = lean + noise(t * 4.5, seed) * w * .62;
  const shape = (scale, offset = 0) => [
    [x-w*.5*scale+offset,y], [x-w*.55*scale+offset,y-h*.27*scale],
    [x-w*.1*scale+bend*.2+offset,y-h*.5*scale], [x+bend*.42+offset,y-h*.71*scale],
    [x+bend+offset,y-h*scale], [x+bend*.76+w*.13*scale+offset,y-h*.57*scale],
    [x+w*.44*scale+offset,y-h*.45*scale], [x+w*.53*scale+offset,y-h*.2*scale],
    [x+w*.26*scale+offset,y+h*.05],
  ];
  p.poly(shape(1),C[0],opacity);
  p.poly(shape(.86,.4),C[1],opacity);
  p.poly(shape(.63,.6),C[2],opacity);
  p.poly(shape(.38,.65),C[3],opacity);
}

function slash(p, t) {
  const lead = -1.28 + 2.52 * ease.outQuad(clamp(t * 2.4 + .18));
  const tail = Math.max(-1.28, lead - (1.9 + t*.6) * A(t,.47));
  const a = A(t,.39);
  wave(p, 27, 7.2*(1-t*.54), mint, a, {keep: angle => {
    const signed = angle > Math.PI ? angle - TAU : angle;
    return signed >= tail && signed <= lead;
  }, hot: t < .36});
  p.arc(0,0,20.5,1,tail+.12,lead-.06,mint[1],a*.65);
  p.arc(0,0,26,2.5,lead-.45,lead+.04,mint[3],a);
  chips(p,t,mint,{radius:27,seed:19,count:8,angle:.1,spread:2.24,size:2.7,trail:true});
}

function muzzle(p, t) {
  const decay = A(t,.12);
  const length = 16 + 12 * ease.outCubic(t);
  const width = (1 - t) * 8 + 1;
  p.poly([[-16,0],[-9,-width],[3,-width*.55],[length,-3],[9,1],[4,width*.64],[-7,width]],gold[0],decay);
  p.poly([[-14,0],[-8,-width*.7],[4,-width*.32],[length-2,-3],[8,1],[4,width*.43],[-7,width*.55]],gold[1],decay);
  p.poly([[-13,0],[-7,-width*.46],[5,-width*.14],[length*.72,-2],[6,2],[-6,width*.35]],gold[2],decay);
  p.poly([[-12,0],[-5,-3],[length*.52,0],[-5,3]],gold[3],decay);
  flash(p,t,gold,10,-8);
  chips(p,t,gold,{x:-4,radius:26,count:10,seed:11,spread:1.25,trail:true});
}

function impact(p,t) {
  flash(p,t,gold,10);
  for (const [angle,length] of [[-.28,20],[1.04,17],[2.15,11],[3.33,14],[4.83,23]]) {
    const drift = 4+length*ease.outCubic(t)*.62;
    streak(p,Math.cos(angle)*drift,Math.sin(angle)*drift,length*(1-t)*.72,2*(1-t)+.7,angle,gold,A(t,.21));
  }
  chips(p,t,ash,{count:7,radius:21,size:2,seed:16});
}

function frost(p,t) {
  const r = 5 + 22 * ease.outCubic(t);
  wave(p,r,2.5,ice,A(t,.36),{hot:t<.2});
  wave(p,r*.68,1.2,ice,A(t,.18)*.68);
  for (let i=0;i<7;i++) {
    const ang = i*TAU/7+.19, travel = r*(.62+rand(i,142)*.2);
    const x=Math.cos(ang)*travel,y=Math.sin(ang)*travel;
    p.place(x+32,y+32,false,ang+Math.PI*.5);
    crystal(p,0,3,(8+rand(i,146)*7)*Math.sin(Math.PI*clamp(t*.85+.19)),5.4,1.4,ice,{a:A(t,.38),white:t<.09});
    p.place(32,32);
  }
  flash(p,t,ice,11);
  chips(p,t,ice,{count:10,radius:26,seed:32,trail:true});
}

function fire(p,t) {
  const height = (1-t)*21+4, opacity = A(t,.29);
  wave(p,5+21*ease.outCubic(t),3.7,ember,opacity*.68,{hot:t<.16});
  for (const [x,y,h,lean,i] of [[-9,5,.76,-6,1],[8,5,.84,4,2],[0,8,1.16,5,3]]) {
    flame(p,x,y-6*t,height*h,12-t*6,lean,t,ember,i,opacity);
  }
  flash(p,t,ember,12);
  chips(p,t,gold,{count:11,radius:22,seed:33,lift:8,trail:true});
}

function heal(p,t) {
  const y = 5-17*ease.outQuad(t);
  const opacity = A(t,.48);
  for (const dy of [12,17]) {
    const rad=8+16*ease.outCubic(t);
    p.ellipse(0,dy-t*7,rad,rad*.27,mint[0],opacity*.26);
    wave(p,rad,1.7,nature,opacity*.65,{centre:[0,dy-t*7],squash:.28});
  }
  const s = 6+3*Math.sin(Math.PI*clamp(t*1.7+.12));
  const cross = [[-3,-s],[3,-s],[3,-3],[s,-3],[s,3],[3,3],[3,s],[-3,s],[-3,3],[-s,3],[-s,-3],[-3,-3]];
  p.poly(cross.map(([x,dy])=>[x+1,y+dy+2]),nature[0],opacity);
  p.poly(cross.map(([x,dy])=>[x,y+dy]),nature[2],opacity);
  p.line(-3,y-s,2,y-s,nature[3],opacity);
  p.line(-s,y-3,-4,y-3,nature[3],opacity);
  p.rect(-2,y-2,4,4,nature[3],opacity);
  for(let i=0;i<5;i++){
    const px=-20+i*10,py=13-(18+rand(i,47)*12)*t+Math.sin(i*2.4)*6;
    p.line(px-2,py,px+2,py,nature[2],opacity*.8);
    p.line(px,py-2,px,py+2,nature[3],opacity*.8);
  }
}

function xp(p,t) {
  const y=-9*ease.outQuad(t);
  diamond(p,0,y,6.5*(1-t*.82),mint,A(t,.24));
  sparkle(p,0,y,5*(1-t),mint[2],ice[2],.25*(1-t));
  chips(p,t,mint,{count:7,radius:19,seed:77,lift:8,trail:true,size:2.2});
}

function pickup(p,t) {
  const radius=5+21*ease.outCubic(t);
  wave(p,radius,3,violet,A(t,.42),{centre:[0,7-t*8],squash:.65,hot:t<.15});
  wave(p,radius*.66,1.7,gold,A(t,.25)*.85,{centre:[0,1-t*8],squash:.65});
  diamond(p,0,-8*t,10*(1-t*.55),gold,A(t,.31));
  for(let i=0;i<5;i++){
    const x=(i-2)*8,y=13-(22+rand(i,81)*12)*t;
    streak(p,x,y,7*(1-t),1.25,-Math.PI/2,i%2?gold:violet,A(t,.25));
  }
  flash(p,t,gold,13);
}

function dash(p,t) {
  const progress=ease.outCubic(t);
  for(let i=0;i<5;i++){
    const x=-5+29*progress-rand(i,23)*7;
    const y=(i-2)*6*(1-t*.48)+rand(i,24)*2;
    streak(p,x,y,(16+rand(i,25)*10)*(1-.75*t),3.2-i*.24,0,mint,A(t,.33));
  }
  p.arc(3+21*progress,0,7.4*(1-t*.33),1.2,-1.15,1.15,ice[3],A(t,.28));
  chips(p,t,ice,{x:-13,radius:15,seed:50,count:7,spread:1.9,angle:Math.PI,trail:true});
}

function shield(p,t) {
  const r=10+16*ease.outCubic(t), opacity=A(t,.31);
  const frame=ngon(0,0,r,6,Math.PI/6);
  p.poly(frame,ice[0],opacity*.15);
  p.polyline([...frame,frame[0]],ice[2],opacity);
  const inner=ngon(0,0,r-2.5,6,Math.PI/6);
  p.polyline([...inner,inner[0]],ice[1],opacity*.73);
  for(let i=0;i<frame.length;i++){
    const [x,y]=frame[i];
    diamond(p,x,y,2.6*(1-t*.55),ice,opacity);
    p.line(x*.74,y*.74,x*.38,y*.38,ice[2],opacity*.42);
  }
  if(t<.35)sparkle(p,0,0,7*(1-t*1.7),ice[2],mint[2],.14);
}

function death(p,t) {
  const progress=ease.outCubic(t), opacity=A(t,.14);
  const r=6+11*progress;
  p.poly(ngon(0,3,r,7,.2),ash[0],opacity*.38);
  for(let i=0;i<14;i++){
    const ang=i*TAU/14+rand(i,25)*.5;
    const d=(8+rand(i,31)*16)*progress;
    const x=d*Math.cos(ang),y=d*Math.sin(ang)-8*t;
    const size=Math.max(1,5*(1-t)*(.55+rand(i,68)));
    p.rect(x-size*.5,y-size*.5,size,size,ash[1],opacity);
    p.rect(x-size*.5,y-size*.5,size,Math.max(1,size*.33),i%3?ash[3]:gold[2],opacity);
  }
  flash(p,t,ash,6);
}

function sonic(p,t) {
  for(let i=2;i>=0;i--){
    const age=clamp((t-i*.14)/(1-i*.14));
    if(age<=0&&i>0)continue;
    const r=4+23*ease.outCubic(age);
    wave(p,r,3.3-age*1.6,mint,A(age,.32)*(1-i*.15),{hot:age<.3,keep:angle=>Math.sin(angle*6+i*.7+age*.6)>-.82});
  }
  flash(p,t,mint,12);
  chips(p,t,mint,{radius:28,count:12,seed:89,trail:true});
}

function shadow(p,t) {
  const expand=ease.outCubic(t), r=7+20*expand,opacity=A(t,.48);
  const teeth=Array.from({length:24},(_,i)=>{
    const angle=i*TAU/24+t*.5;
    const radius=r*(i%2?.67:1+rand(i,95)*.065);
    return [Math.cos(angle)*radius,Math.sin(angle)*radius];
  });
  p.poly(teeth,violet[0],opacity*.7);
  p.polyline([...teeth,teeth[0]],violet[1],opacity);
  wave(p,r*.71,3.3,violet,opacity,{hot:t<.22,keep:angle=>Math.sin(angle*4-t*2)>-.62});
  diamond(p,0,0,8*(1-t),violet,opacity*.92);
  chips(p,t,violet,{count:14,radius:25,seed:97,trail:true});
}

function earth(p,t) {
  const r=5+22*ease.outCubic(t), opacity=A(t,.34);
  wave(p,r,4,ash,opacity,{hot:t<.15});
  wave(p,r-2,1.3,gold,opacity*.8,{keep:angle=>Math.sin(angle*5)>.09});
  for(let i=0;i<8;i++){
    const angle=i*TAU/8+rand(i,101)*.27;
    const length=r*(.68+rand(i,12)*.3);
    const x=Math.cos(angle),y=Math.sin(angle);
    const joint=[x*length*.48+y*2,y*length*.48-x*2];
    p.polyline([[x*3,y*3],joint,[x*length,y*length]],ash[0],opacity);
    p.line(joint[0],joint[1],x*length*.8+y*3,y*length*.8-x*3,gold[1],opacity*.72);
  }
  chips(p,t,ash,{radius:26,count:16,seed:132,size:4.5});
  flash(p,t,gold,10);
}

function dragon(p,t) {
  const fade=A(t,.41);
  const reach=15+11*ease.outCubic(t);
  for(let i=0;i<5;i++){
    const angle=(i-2)*.18;
    const x=reach*(.67+rand(i,111)*.25),y=Math.tan(angle)*x*1.75;
    streak(p,x,y,37*(1-t*.63),5*(1-t*.7),angle,violet,fade);
  }
  for(let i=0;i<4;i++){
    const x=-7+9*i,y=8*(rand(i,12)-.5)+3;
    flame(p,x,y,11*(1-t*.65),9,-3,t,violet,i,fade*.86);
  }
  chips(p,t,violet,{x:-7,radius:28,count:13,seed:19,spread:1.2,trail:true});
}

function echo(p,t) {
  const r=6+21*ease.outCubic(t);
  const gap=t*.9+.2;
  wave(p,r,5.1*(1-t*.52),mint,A(t,.32),{hot:t<.28,keep:angle=>Math.abs(Math.sin(angle+gap))>.21});
  wave(p,r*.71,2.6,ice,A(t,.28)*.85,{keep:angle=>Math.abs(Math.cos(angle+gap))>.35});
  p.arc(0,0,r*.46,2,-.8,1.05,mint[2],A(t,.38));
  p.arc(0,0,r*.47,2,2.26,4.1,ice[2],A(t,.35));
  flash(p,t,mint,15);
  chips(p,t,ice,{radius:28,count:15,seed:79,size:3,trail:true});
}

function ricochet(p,t) {
  const opacity=A(t,.18);
  const x=3+7*ease.outQuad(t), y=-3-5*ease.outQuad(t);
  p.polyline([[-15,8],[-5,2],[x,y],[13,6]],violet[1],opacity);
  p.line(-9,3,x,y,ice[2],opacity);
  p.line(x,y,13,6,gold[2],opacity);
  sparkle(p,x,y,8*(1-t*.8),ice[3],gold[2],.2*(1-t));
  chips(p,t,ice,{x,y,count:6,radius:17,seed:27,size:2,trail:true});
}

function fireCombo(p,t) {
  const r=7+20*ease.outCubic(t);
  const opacity=A(t,.37);
  wave(p,r,4.5,ember,opacity,{hot:t<.25});
  wave(p,r*.78,2,violet,opacity*.67,{keep:angle=>Math.sin(angle*6+t*2)>-.1});
  for(let i=0;i<8;i++){
    const angle=i*TAU/8+.25;
    const x=Math.cos(angle)*r*.81,y=Math.sin(angle)*r*.81;
    flame(p,x,y,6.3*(1-t)+rand(i,37)*3,5.3,Math.cos(angle)*3,t,ember,i,opacity);
  }
  const bounce=A(t,.18)*(1-clamp((t-.24)/.38));
  p.polyline([[-19,6],[-7,-8],[10,3]],violet[2],bounce);
  p.polyline([[-17,7],[-7,-6],[10,3]],violet[1],bounce);
  flash(p,t,gold,13,0,0);
  chips(p,t,ember,{count:13,radius:27,seed:68,trail:true});
}

function shrapnel(p,t) {
  const drift=ease.outCubic(t);
  const fade=A(t,.17);
  for(let i=0;i<3;i++){
    const angle=(i-1)*.26;
    const distance=11+25*drift;
    const x=-15+Math.cos(angle)*distance,y=Math.sin(angle)*distance*1.4;
    streak(p,x,y,13*(1-t*.64),3.4-t*2,angle,i===1?gold:ember,fade);
    p.rect(x-1,y-1,2,2,gold[3],fade);
  }
  flash(p,t,gold,13,-12);
  chips(p,t,gold,{x:-11,radius:29,count:10,seed:23,spread:1.2,trail:true});
}

function poison(p,t) {
  const opacity=A(t,.4);
  for(let i=0;i<6;i++){
    const x=(i-2.5)*6*(.6+t*.42),y=7-rand(i,14)*10-t*(8+rand(i,13)*5);
    const r=4+rand(i,17)*3+6*ease.outQuad(t);
    p.poly(ngon(x,y,r,8,Math.PI/8),nature[0],opacity*.62);
    p.poly(ngon(x-.5,y-1,r*.68,7,.41),nature[1],opacity*.82);
    p.arc(x-.5,y-1,r*.58,1.25,Math.PI,Math.PI*1.85,nature[2],opacity*.73);
  }
  chips(p,t,nature,{count:10,radius:22,seed:13,lift:10,size:2.4});
}

function warp(p,t) {
  const opacity=A(t,.3), r=7+19*ease.outCubic(t);
  wave(p,r,2.2,violet,opacity,{keep:angle=>Math.sin(angle*4-t*4)>.18});
  for(let i=0;i<9;i++){
    const x=(i-4)*5,y=15-(16+rand(i,37)*17)*t;
    const h=(6+rand(i,39)*12)*(1-t*.76);
    p.rect(x,y-h,2,h,i%2?violet[2]:violet[1],opacity);
    p.dot(x,y-h,gold[3],opacity);
    if(i%2===0)p.rect(x+2,y+3,2,2,violet[3],opacity);
  }
  diamond(p,0,-5,6*(1-t*.74),violet,opacity);
  chips(p,t,violet,{radius:25,count:10,seed:57,lift:8,trail:true});
}

export const pixelFxDesigns = Object.freeze({
  slash, muzzle, impact, frost, fire, heal, xp, pickup, dash, shield, death,
  sonic, shadow, earth, dragon, 'combo-echo': echo, 'combo-fire': fireCombo,
  'combo-shrapnel': shrapnel, ricochet, poison, warp,
});
