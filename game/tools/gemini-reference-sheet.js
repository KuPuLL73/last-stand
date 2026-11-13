import * as THREE from 'three';
import {getUpgradeDefs} from '../survival-core.js';
import {icon} from '../survival-icons.js';
import {steveIcon} from '../steve-icons.js';
import {BOOSTS,BOOST_POSES,createBoostGeometry,createBoostMaterial} from '../boost-models.js';
import {boostImages} from '../boost-icons.js';

const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const ranks=value=>`${value} ${value===1?'ранг':value>=2&&value<=4?'ранга':'рангов'}`;
const styles={damage:'sword',pellets:'sweep',pierce:'bow',ricochet:'return',burn:'fire'};
const currentIcon=(id,character)=>character==='steve'&&styles[id]?steveIcon(styles[id]):icon(id);
const variants=[{label:'СТИВ · БЛИЖНЕЕ ОРУЖИЕ',character:'steve',weapon:'wooden-sword'},{label:'СТИВ · ДАЛЬНЕЕ ОРУЖИЕ',character:'steve',weapon:'hunting-bow'},{label:'ШЕЛЛИ',character:'shelly'}].map(v=>({...v,defs:getUpgradeDefs(v.character,v.weapon)}));
const ids=variants[0].defs.map(d=>d.id);
const upgradeGrid=document.querySelector('.upgrades-grid');
for(const [index,id] of ids.entries()){
 const all=variants.map(v=>({...v,definition:v.defs.find(d=>d.id===id)}));
 const shared=all.every(v=>v.definition.name===all[0].definition.name&&v.definition.description===all[0].definition.description);
 const visible=shared?[{...all[0],label:'ОБЩЕЕ · СТИВ И ШЕЛЛИ',character:'shelly'}]:all;
 const card=document.createElement('article');card.className='upgrade';card.dataset.upgrade=id;
 card.innerHTML=`<header class="card-top"><span class="card-index">${String(index+1).padStart(2,'0')} <span class="card-id">${escape(id)}</span></span><span class="max">Максимум: ${ranks(all[0].definition.max)}</span></header>${visible.map(v=>`<div class="variant"><span class="variant-icon">${currentIcon(id,v.character)}</span><div><p class="variant-label">${v.label}</p><h2>${escape(v.definition.name)}</h2><p>${escape(v.definition.description)}</p></div></div>`).join('')}${shared?'<p class="shared-note">Название, эффект и иконка одинаковы для обоих героев и типов оружия Стива.</p>':''}`;
 upgradeGrid.append(card);
}

const renderers=[];
for(const [id,definition] of Object.entries(BOOSTS)){
 const card=document.createElement('article');card.className='boost';card.dataset.boost=id;
 card.innerHTML=`<header class="boost-header"><h2>${escape(definition.name)}</h2><span class="boost-id">${id}</span></header><div class="model" aria-label="Текущая 3D-модель ${escape(definition.name)}"></div><div class="hud-row"><img src="${boostImages[id]}" alt="Текущая HUD-иконка"><div><span class="hud-label">PNG ДЛЯ HUD</span><p class="boost-effect">${escape(definition.detail)}</p></div></div><p class="boost-note">Действие: <span class="duration">${definition.duration?definition.duration+' активных секунд':'моментальный эффект'}</span></p><p class="boost-footer">Настоящая игровая геометрия · без замены иллюстрацией</p>`;
 document.querySelector('.boost-grid').append(card);
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(630,370);renderer.setPixelRatio(1);renderer.setClearColor('#17222e',0);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
 const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#ecfbff','#657386',2.2));const sun=new THREE.DirectionalLight('#ffffff',3.2);sun.position.set(-3,6,7);scene.add(sun);const rim=new THREE.DirectionalLight('#8feaff',1.4);rim.position.set(5,3,-4);scene.add(rim);
 const model=new THREE.Mesh(createBoostGeometry(id),createBoostMaterial());model.rotation.y=BOOST_POSES[id]?.yaw||0;scene.add(model);
 const camera=new THREE.OrthographicCamera(-1.04,1.04,.61,-.61,.1,30);camera.position.set(2.5,1.5,5.5);camera.lookAt(0,0,0);
 card.querySelector('.model').append(renderer.domElement);renderer.render(scene,camera);renderers.push({renderer,scene,camera,id});
}
await Promise.all([...document.images].map(img=>img.decode()));
await document.fonts.ready;
window.__referenceSheet={ready:true,upgradeIds:ids,boostIds:Object.keys(BOOSTS),variants:variants.map(v=>({label:v.label,character:v.character,weapon:v.weapon,defs:v.defs})),boosts:BOOSTS,renderers};
document.body.dataset.ready='true';
