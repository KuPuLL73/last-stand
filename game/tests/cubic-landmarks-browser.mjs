import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']}),errors=[];
try{
 const page=await browser.newPage({viewport:{width:1600,height:800},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 await page.goto('http://127.0.0.1:5190/game/artifacts/cubic-landmarks-preview.html');
 await page.waitForFunction(()=>window.__landmarkPreview?.scene.children.some(o=>o.isInstancedMesh));await page.waitForTimeout(1000);
 const report=await page.evaluate(()=>{const v=window.__landmarkPreview;let fakeMineCards=0,boxes=0;v.scene.traverse(o=>{if(o.name==='Mine entrance'&&o.geometry?.type==='PlaneGeometry')fakeMineCards++;if(o.isInstancedMesh&&o.geometry.attributes.normal)boxes+=o.count;});return{fakeMineCards,boxes,obstacles:v.arena.obstacles.length,calls:v.renderer.info.render.calls};});
 assert.equal(report.fakeMineCards,0);assert.equal(report.obstacles,7);assert.ok(report.boxes>500);assert.deepEqual(errors,[]);
 await page.screenshot({path:'game/artifacts/cubic-landmarks-final.png'});await writeFile('game/artifacts/cubic-landmarks-results.json',JSON.stringify({passed:true,...report,errors},null,2));console.log(JSON.stringify({passed:true,...report,errors}));
}finally{await browser.close();}
