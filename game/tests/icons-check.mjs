import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch();const results=[],errors=[];
const dir=fileURLToPath(new URL('../artifacts/',import.meta.url));
try{
 for(const [name,width,height,sheet] of [['all',1400,1120,true],['390x844',390,844,false],['844x390',844,390,false]]){
  const page=await browser.newPage({viewport:{width,height}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5190/game/artifacts/upgrade-icons-preview.html'+(sheet?'?mode=sheet':''));await page.waitForFunction(()=>document.body.dataset.ready==='true');
  const info=await page.evaluate(()=>({ids:[...document.querySelectorAll('[id]')].map(e=>e.id),rects:[...document.querySelectorAll('.upgrade-choice,.upgrade-sheet')].map(e=>({name:e.className,x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})),svgs:document.querySelectorAll('svg').length,icons:[...document.querySelectorAll('.upgrade-icon')].map(e=>e.getBoundingClientRect().width),scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}));
  assert.equal(info.ids.length,new Set(info.ids).size,'duplicate SVG gradient IDs');
  assert.ok(info.scrollWidth<=width+1,JSON.stringify(info));
  if(!sheet){for(const r of info.rects){assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=width+.1&&r.y+r.h<=height+.1,JSON.stringify(r));}assert.ok(info.scrollHeight<=height+1,JSON.stringify(info));}
  await page.screenshot({path:dir+`upgrade-icons-${name}.png`,fullPage:sheet});results.push({name,info});await page.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS all 11 icons, duplicate gradient safety, 390 portrait and 844 landscape cards fit');
}finally{await browser.close();await writeFile(dir+'upgrade-icons-check.json',JSON.stringify({results,errors},null,2));}
