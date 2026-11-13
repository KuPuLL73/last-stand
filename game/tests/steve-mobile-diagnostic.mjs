import {chromium} from '@playwright/test';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const b=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']});
try{
 const c=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1});
 const p=await c.newPage();await p.goto('http://127.0.0.1:5190/survival.html');await p.waitForFunction(()=>document.body.dataset.ready==='true');await p.locator('#start').tap();
 const snapshot=()=>p.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,vw:visualViewport.width,vh:visualViewport.height,els:[...document.querySelectorAll('body *')].map(e=>{const r=e.getBoundingClientRect();return{tag:e.tagName,id:e.id,cls:e.className?.baseVal??e.className,x:r.x,y:r.y,w:r.width,h:r.height};}).filter(x=>x.x+x.w>395||x.y+x.h>850)}));
 console.log('BEFORE',JSON.stringify(await snapshot()));
 await p.evaluate(()=>{const r=window.__survivalTest.run,s=r.state,p=s.player;r._spawnClock=999;s.enemies=[];s.drops=[];s.projectiles=[];p.invulnerable=999;const e=r._spawnEnemy('walker',p.x+6,p.z);e.hp=e.maxHp=100000;e.speed=0;});
 await p.locator('#super').tap();
 for(let i=0;i<8;i++){await p.waitForTimeout(200);const s=await snapshot();console.log('AFTER'+i,JSON.stringify(s));if(s.w>400)break;}
 await p.screenshot({path:join(tmpdir(),'steve-qa-mobile-diagnostic.png')});
}finally{await b.close();}
