import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {fileURLToPath} from 'node:url';
import {PIXEL_FX_COLUMNS as columns,PIXEL_FX_ROWS,PIXEL_FX_TILE as tile} from '../pixel-fx-atlas.js';
import {pixelFxDesigns} from './pixel-fx-designs.mjs';
import {Painter} from './vendor/pixelfx/src/core/painter.js';
import {hex} from './vendor/pixelfx/src/core/color.js';
import {encodePNG} from './vendor/pixelfx/tools/lib/png.mjs';

function frame(w,h){
  return {w,h,ox:0,oy:0,color:new Uint32Array(w*h),light:new Uint32Array(w*h)};
}

// Transparent branch of PixelFX's compositor. The two buffers keep flat
// pixel colours crisp while light pixels soften just the immediate highlights.
// Adapted from src/core/fx.js at the commit recorded in vendor/pixelfx/README.md.
function composite(f, lightStrength = .42){
  const data = new Uint8ClampedArray(f.w*f.h*4);
  for(let i=0;i<f.color.length;i++){
    const c=f.color[i],light=f.light[i];
    const alpha=(c>>>24)/255;
    const lightRGB=[light&255,(light>>>8)&255,(light>>>16)&255];
    const opacity=Math.max(alpha,Math.max(...lightRGB)*lightStrength/255);
    if(!opacity)continue;
    for(let ch=0;ch<3;ch++)data[i*4+ch]=(((c>>>(ch*8))&255)*alpha+lightRGB[ch]*lightStrength)/opacity;
    data[i*4+3]=opacity*255;
  }
  return data;
}

function blit(src,srcWidth,dest,destWidth,left,top,scale=1,background=false){
  for(let y=0;y<src.length/(srcWidth*4);y++)for(let x=0;x<srcWidth;x++){
    const index=(y*srcWidth+x)*4;
    for(let sy=0;sy<scale;sy++)for(let sx=0;sx<scale;sx++){
      const target=((top+y*scale+sy)*destWidth+left+x*scale+sx)*4;
      const alpha=src[index+3]/255;
      if(background){
        for(let ch=0;ch<3;ch++)dest[target+ch]=src[index+ch]*alpha+dest[target+ch]*(1-alpha);
      }else dest.set(src.subarray(index,index+4),target);
    }
  }
}

const names=Object.keys(PIXEL_FX_ROWS);
assert.deepEqual(Object.keys(pixelFxDesigns).sort(),[...names].sort(),'all rows have one design');
assert.deepEqual(Object.values(PIXEL_FX_ROWS),names.map((_,i)=>i),'row indices are contiguous');
const width=tile*columns,height=tile*names.length;
const atlas=new Uint8ClampedArray(width*height*4);
const stats=[];
const samples=[];
const sampleColumns=[0,3,7,12];
for(const name of names){
  const row=PIXEL_FX_ROWS[name],paint=pixelFxDesigns[name];
  const counts=[],visibleEdges=[];
  const tiles=[];
  for(let column=0;column<columns;column++){
    const f=frame(tile,tile),p=new Painter(f).place(tile/2,tile/2);
    paint(p,column/columns);
    const pixels=composite(f);
    let solid=0,edge=0;
    for(let y=0;y<tile;y++)for(let x=0;x<tile;x++){
      const a=pixels[(y*tile+x)*4+3];
      if(a>=48){
        solid++;
        if(x===0||y===0||x===tile-1||y===tile-1)edge++;
      }
    }
    counts.push(solid);
    visibleEdges.push(edge);
    blit(pixels,tile,atlas,width,column*tile,row*tile);
    if(sampleColumns.includes(column))tiles.push(pixels);
  }
  assert.ok(counts[0]>=12,`${name} has a visible onset`);
  assert.ok(Math.max(...counts)>=60,`${name} has a solid silhouette`);
  assert.ok(counts.at(-1)<Math.max(...counts)*.60,`${name} decays before removal`);
  assert.ok(visibleEdges.every(count=>count===0),`${name} stays inside its tile`);
  stats.push({name,row,visiblePixels:counts,edgePixels:visibleEdges});
  samples.push(tiles);
}

// Frame contacts grouped by effect, showing the attack, peak and decay at 2×.
const groupWidth=536,groupHeight=160,groupsAcross=3;
const sheet=frame(groupWidth*groupsAcross,54+groupHeight*Math.ceil(names.length/groupsAcross));
const painter=new Painter(sheet);
painter.rect(0,0,sheet.w,sheet.h,hex('#101724'));
painter.text('PIXELFX / COMBAT & PICKUPS',16,14,hex('#f3ead1'),{font:'big',scale:3});
painter.text('21 EFFECTS  /  FRAMES 01 04 08 13  /  2X',16,40,hex('#a1b5c8'),{font:'mini',scale:1});
names.forEach((name,index)=>{
  const x=(index%groupsAcross)*groupWidth+8;
  const y=Math.floor(index/groupsAcross)*groupHeight+54;
  painter.rect(x,y,groupWidth-16,groupHeight-10,hex('#1a2536'));
  painter.text(name.toUpperCase(),x+8,y+6,hex('#d5e7f1'),{font:'mini',scale:2});
  for(let sample=0;sample<4;sample++)painter.rect(x+4+sample*128,y+18,126,128,hex(sample%2?'#283341':'#202b3a'));
});
const contact=composite(sheet);
samples.forEach((tiles,index)=>tiles.forEach((pixels,sample)=>{
  const x=(index%groupsAcross)*groupWidth+12+sample*128;
  const y=Math.floor(index/groupsAcross)*groupHeight+72;
  blit(pixels,tile,contact,sheet.w,x,y,2,true);
}));

const destination=new URL('../assets/effects/',import.meta.url);
const artifacts=new URL('../artifacts/',import.meta.url);
await mkdir(destination,{recursive:true});
await mkdir(artifacts,{recursive:true});
const encoded=encodePNG(width,height,atlas);
await Promise.all([
  writeFile(new URL('pixel-fx.png',destination),encoded),
  writeFile(new URL('pixel-fx-contact.png',artifacts),encodePNG(sheet.w,sheet.h,contact)),
  writeFile(new URL('pixel-fx-export.json',artifacts),JSON.stringify({width,height,bytes:encoded.length,stats},null,2)),
]);
console.log(`${names.length} effects × ${columns} frames. ${width}×${height}, ${encoded.length} bytes. Preview: game/artifacts/pixel-fx-contact.png`);

if(process.argv.includes('--gif')){
  const across=7,cellWidth=90,cellHeight=82;
  const board=frame(across*cellWidth,28+cellHeight*Math.ceil(names.length/across));
  const painter=new Painter(board);
  painter.rect(0,0,board.w,board.h,hex('#101724'));
  painter.text('PIXELFX / COMBAT AND PICKUPS',8,9,hex('#f3ead1'),{font:'big',scale:2});
  const cards=names.map((name,row)=>{
    const x=(row%across)*cellWidth+2,y=Math.floor(row/across)*cellHeight+29;
    painter.rect(x,y,cellWidth-4,cellHeight-4,hex('#1a2536'));
    painter.text(name.toUpperCase(),x+4,y+4,hex('#d5e7f1'),{font:'mini'});
    return {x:x+10,y:y+12,row};
  });
  const durations=[.26,.16,.18,.35,.45,.65,.25,.52,.22,.40,.40,.42,.55,.50,.60,.40,.45,.23,.18,.50,.40];
  const background=composite(board);
  function* frames(){
    for(let index=0;index<31;index++){
      const data=background.slice();
      for(const {x,y,row} of cards){
        const age=(index-2-row%3*2)/30,duration=durations[row];
        if(age<0||age>=duration)continue;
        const column=Math.min(columns-1,Math.floor(age/duration*columns));
        const sprite=new Uint8ClampedArray(tile*tile*4);
        for(let line=0;line<tile;line++){
          const start=((row*tile+line)*width+column*tile)*4;
          sprite.set(atlas.subarray(start,start+tile*4),line*tile*4);
        }
        blit(sprite,tile,data,board.w,x,y,1,true);
      }
      yield Buffer.from(data.buffer);
    }
  }
  const path=fileURLToPath(new URL('pixel-fx-preview.gif',artifacts));
  const ffmpeg=spawn('ffmpeg',[
    '-v','error','-y','-f','rawvideo','-pixel_format','rgba','-video_size',`${board.w}x${board.h}`,
    '-framerate','30','-i','pipe:0','-filter_complex',
    '[0:v]scale=iw*2:ih*2:flags=neighbor,split[a][b];[a]palettegen=stats_mode=full[p];[b][p]paletteuse=dither=none',
    '-loop','0',path,
  ],{windowsHide:true,stdio:['pipe','ignore','inherit']});
  const exited=new Promise((resolve,reject)=>{
    ffmpeg.once('error',reject);
    ffmpeg.once('close',code=>code===0?resolve():reject(new Error(`FFmpeg exited ${code}`)));
  });
  await Promise.all([pipeline(Readable.from(frames()),ffmpeg.stdin),exited]);
  console.log('Animated preview: game/artifacts/pixel-fx-preview.gif');
}
