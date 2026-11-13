import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const assetDir=path.join(root,'game/assets/upgrades'),reportPath=path.join(root,'game/artifacts/upgrade-art-export.json');
const items=['damage-melee','damage-ranged','damage-shell','rate','area-melee','area-ranged','area-shell','knockback','pierce','ricochet','burn','speed','maxhp','regen','pickup','echo-wave','fire-ricochet','shrapnel-line'];
const args=process.argv.slice(2);
if(args.some(arg=>arg!=='--items-only'))throw new Error('Usage: node game/tools/export-upgrade-art.mjs [--items-only]');
const keys=args.includes('--items-only')?items:[...items,'card-frame','rank-star'];
const sha256=data=>createHash('sha256').update(data).digest('hex');
const execute=command=>{
 const result=spawnSync('ffmpeg',command,{maxBuffer:256*1024*1024,windowsHide:true});
 if(result.error)throw result.error;
 if(result.status!==0)throw new Error(`ffmpeg exited ${result.status}: ${result.stderr.toString().trim()}`);
 return result.stdout;
};
const raw=(filename,width,height)=>execute(['-v','error','-i',filename,...(width&&height?['-vf',`scale=${width}:${height}:flags=lanczos`]:[]),'-frames:v','1','-f','rawvideo','-pix_fmt','rgba','pipe:1']);
function pngInfo(data){
 if(data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||data.toString('ascii',12,16)!=='IHDR')throw new Error('Invalid PNG signature/IHDR');
 const info={width:data.readUInt32BE(16),height:data.readUInt32BE(20),bitDepth:data[24],colorType:data[25]};
 if(info.colorType!==6)throw new Error(`PNG must have an RGBA color type (6), got ${info.colorType}`);
 return info;
}
function alphaInfo(pixels,width,height){
 if(pixels.length!==width*height*4)throw new Error(`Unexpected decoded RGBA buffer length ${pixels.length}`);
 let min=255,max=0,transparent=0,translucent=0;
 for(let i=3;i<pixels.length;i+=4){const a=pixels[i];min=Math.min(min,a);max=Math.max(max,a);if(a===0)transparent++;else if(a<255)translucent++;}
 return{min,max,transparent,translucent,cornerAlpha:[pixels[3],pixels[(width-1)*4+3],pixels[((height-1)*width)*4+3],pixels[pixels.length-1]]};
}
function webpInfo(data){
 if(data.toString('ascii',0,4)!=='RIFF'||data.toString('ascii',8,12)!=='WEBP'||data.readUInt32LE(4)+8!==data.length)throw new Error('Invalid WebP RIFF container');
 const chunks=[];let width,height;
 for(let offset=12;offset+8<=data.length;){
  const type=data.toString('ascii',offset,offset+4),length=data.readUInt32LE(offset+4),start=offset+8;
  if(start+length>data.length)throw new Error('Invalid WebP chunk length');
  chunks.push(type);
  if(type==='VP8X'){width=data.readUIntLE(start+4,3)+1;height=data.readUIntLE(start+7,3)+1;}
  else if(type==='VP8 '&&!width){width=data.readUInt16LE(start+6)&0x3fff;height=data.readUInt16LE(start+8)&0x3fff;}
  else if(type==='VP8L'&&!width){const bits=data.readUInt32LE(start+1);width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1;}
  offset+=8+length+(length&1);
 }
 if(!chunks.some(chunk=>chunk==='VP8 '||chunk==='VP8L')||chunks.includes('ANIM'))throw new Error('Expected one still WebP image');
 return{chunks,width,height,hasAlpha:chunks.includes('ALPH')||chunks.includes('VP8L')};
}

mkdirSync(path.dirname(reportPath),{recursive:true});
const version=execute(['-version']).toString().split(/\r?\n/)[0];
const report={generatedAt:new Date().toISOString(),tool:version,mode:args.includes('--items-only')?'items-only':'complete',settings:{itemSize:[640,640],frameSize:'source',starSize:[256,256],quality:90,alphaQuality:100,compressionLevel:6,scaleFilter:'lanczos',alphaVerification:'Decoded WebP alpha is byte-identical to the transformed PNG alpha. FFmpeg libwebp uses its default alpha_quality=100.'},assets:[],errors:[]};
for(const key of keys){
 try{
  const source=path.join(assetDir,`${key}.png`),destination=path.join(assetDir,`${key}.webp`),sourceData=readFileSync(source),sourceInfo=pngInfo(sourceData);
  if(items.includes(key)&&sourceInfo.width!==sourceInfo.height)throw new Error(`${key}: item source must be square`);
  const width=key==='card-frame'?sourceInfo.width:key==='rank-star'?256:640,height=key==='card-frame'?sourceInfo.height:key==='rank-star'?256:640;
  const sourceAlpha=alphaInfo(raw(source),sourceInfo.width,sourceInfo.height);
  if(sourceAlpha.min!==0||sourceAlpha.max!==255||sourceAlpha.transparent===0)throw new Error(`${key}: source must contain real transparent and opaque RGBA pixels`);
  const command=['-hide_banner','-v','error','-y','-i',source,'-vf',`scale=${width}:${height}:flags=lanczos`,'-frames:v','1','-c:v','libwebp','-lossless','0','-quality','90','-compression_level','6','-pix_fmt','bgra',destination];
  execute(command);
  const output=readFileSync(destination),container=webpInfo(output),expectedPixels=raw(source,width,height),actualPixels=raw(destination),outputAlpha=alphaInfo(actualPixels,width,height);
  if(container.width!==width||container.height!==height)throw new Error(`${key}: WebP header dimensions ${container.width}x${container.height} do not match ${width}x${height}`);
  if(sha256(readFileSync(source))!==sha256(sourceData))throw new Error(`${key}: PNG source changed while exporting; rerun the export`);
  let mismatches=0,maxDifference=0;
  for(let i=3;i<expectedPixels.length;i+=4){const difference=Math.abs(expectedPixels[i]-actualPixels[i]);if(difference)mismatches++;maxDifference=Math.max(maxDifference,difference);}
  if(!container.hasAlpha||mismatches)throw new Error(`${key}: alpha differs after WebP encoding (${mismatches} pixels, maximum error ${maxDifference})`);
  const result={key,source:path.relative(root,source).replaceAll('\\','/'),runtime:path.relative(root,destination).replaceAll('\\','/'),sourceHash:sha256(sourceData),runtimeHash:sha256(output),sourceDimensions:[sourceInfo.width,sourceInfo.height],dimensions:[width,height],sourceBytes:sourceData.length,runtimeBytes:output.length,savedPercent:Number((100*(1-output.length/sourceData.length)).toFixed(2)),sourceFormat:sourceInfo,sourceAlpha,outputAlpha,webp:container,alphaLossless:true,alphaMismatches:mismatches,alphaMaxDifference:maxDifference,command:['ffmpeg',...command]};
  report.assets.push(result);
  console.log(`PASS ${key}: ${sourceInfo.width}x${sourceInfo.height} PNG -> ${width}x${height} WebP; ${output.length} bytes; alpha identical`);
 }catch(error){report.errors.push({key,error:error.stack||String(error)});console.error(`FAIL ${key}: ${error.message}`);}
}
report.totals={expected:keys.length,exported:report.assets.length,sourceBytes:report.assets.reduce((sum,a)=>sum+a.sourceBytes,0),runtimeBytes:report.assets.reduce((sum,a)=>sum+a.runtimeBytes,0)};
report.ok=report.errors.length===0&&report.assets.length===keys.length;
writeFileSync(reportPath,`${JSON.stringify(report,null,2)}\n`);
console.log(`Upgrade art export: ${report.assets.length}/${keys.length}; report ${reportPath}`);
if(!report.ok)process.exitCode=1;
