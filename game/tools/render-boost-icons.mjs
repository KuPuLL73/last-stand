import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const directory=fileURLToPath(new URL('../assets/boosts/',import.meta.url));
await mkdir(directory,{recursive:true});
const browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']});
const images=new Map();
try{
 const page=await browser.newPage({viewport:{width:1280,height:256},deviceScaleFactor:1});
 await page.goto('http://127.0.0.1:5190/game/artifacts/boost-icon-render.html');
 await page.waitForFunction(()=>document.body.dataset.ready==='true');
 for(const id of ['heal','haste','rapid','shield','magnet']){
  images.set(id,await page.locator(`canvas[data-boost="${id}"]`).screenshot({omitBackground:true}));
 }
}finally{await browser.close();}
// Writing an imported PNG can trigger Vite HMR. Capture all five before writing
// any files, so exports can never reload their own rendering context halfway.
for(const[id,bytes]of images){await writeFile(directory+id+'.png',bytes);console.log(`Rendered ${id}.png from the actual 3D collectible`);}
