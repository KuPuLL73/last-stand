import {getRunUpgradeDefs} from './survival-core.js';
import {isCombinationUnlocked,getUpgradeCombination} from './upgrade-combinations.js';
import {upgradePresentation} from './upgrade-presentation.js';
import {upgradeImage} from './upgrade-art.js';

function combinationIngredients(state,combination){
 const ingredients=document.createElement('span');
 ingredients.className='combo-ingredients';
 for(const [index,requirement] of combination.requirements.entries()){
  if(index){
   const plus=document.createElement('span');
   plus.className='combo-plus';plus.textContent='+';plus.setAttribute('aria-hidden','true');
   ingredients.append(plus);
  }
  const info=upgradePresentation(state,requirement.id);
  const current=Math.min(requirement.rank,state.upgrades[requirement.id]||0);
  const part=document.createElement('span');
  part.className='combo-ingredient';part.dataset.complete=String(current===requirement.rank);
  part.title=`${info.name} · ${current}/${requirement.rank}`;
  const image=document.createElement('img');
  image.src=upgradeImage(info.art);image.alt=info.name;image.width=25;image.height=25;image.draggable=false;
  const progress=document.createElement('span');progress.textContent=`${current}/${requirement.rank}`;
  part.append(image,progress);ingredients.append(part);
 }
 return ingredients;
}

/** Show the recipe while the player is deciding which base card to level. */
export function updateCombinationProgress(container,state){
 const combination=getUpgradeCombination(state.character,state.player?.weapon?.id||state.weaponId);
 const show=combination&&!isCombinationUnlocked(combination,state.upgrades)&&combination.requirements.some(requirement=>
  state.upgrades[requirement.id]>0||state.choices.some(choice=>choice.id===requirement.id));
 container.hidden=!show;container.replaceChildren();
 if(!show)return;
 const name=document.createElement('b');name.textContent=combination.name;
 container.dataset.combination=combination.id;
 container.append(name,combinationIngredients(state,combination));
}

/** The same live card is used by the run and the visual catalogue. */
export function createUpgradeCard(state,id,index,onChoose){
 const presentation=upgradePresentation(state,id),weaponId=state.player?.weapon?.id||state.weaponId;
 const definition=getRunUpgradeDefs(state.character,weaponId).find(u=>u.id===id);
 const max=definition?.max||5,current=state.upgrades[id]||0,next=Math.min(max,current+1);
 const button=document.createElement('button');button.type='button';button.className='upgrade-choice';button.dataset.upgrade=id;button.dataset.art=presentation.art;
 const combination=presentation.combination;
 if(combination)button.dataset.combination=combination.id;
 button.setAttribute('aria-label',`${combination?'Комбинация. ':''}${presentation.name}. ${presentation.bonuses.join('. ')}. Ранг ${next} из ${max}`);
 const rank=document.createElement('span');rank.className='upgrade-stars';rank.setAttribute('aria-hidden','true');
 for(let n=1;n<=max;n++){
  const star=document.createElement('img');star.src=upgradeImage('rank-star');star.alt='';star.width=22;star.height=22;star.draggable=false;star.className=n<=current?'earned':n===next?'next':'locked';rank.append(star);
 }
 const key=document.createElement('kbd');key.textContent=String(index+1);key.setAttribute('aria-hidden','true');
 const art=document.createElement('span');art.className='upgrade-icon';art.setAttribute('aria-hidden','true');
 const img=document.createElement('img');img.src=upgradeImage(presentation.art);img.alt='';img.width=384;img.height=384;img.draggable=false;img.decoding='async';art.append(img);
 const title=document.createElement('b');title.className='upgrade-name';title.textContent=presentation.name;
 const bonus=document.createElement('p');bonus.className='upgrade-bonuses';
 for(const [i,text]of presentation.bonuses.entries()){
  const line=document.createElement('span');line.className=i===0?'bonus-primary':'bonus-secondary';line.textContent=text;bonus.append(line);
 }
 button.append(key);
 if(combination){
  const ribbon=document.createElement('span');ribbon.className='combo-ribbon';
  ribbon.textContent=current?'Усиление комбо':'Комбинация';ribbon.setAttribute('aria-hidden','true');
  button.append(ribbon);
 }
 button.append(rank,art,title,bonus);
 if(combination&&!current)button.append(combinationIngredients(state,combination));
 if(onChoose)button.addEventListener('click',()=>onChoose(id));
 return button;
}

