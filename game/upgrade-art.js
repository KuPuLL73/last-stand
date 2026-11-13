// Generated illustrations are exported separately from live card copy/ranks.
const files=import.meta.glob('./assets/upgrades/*.webp',{eager:true,query:'?url',import:'default'});
export const upgradeImages=Object.fromEntries(Object.entries(files).map(([path,url])=>[path.split('/').pop().replace('.webp',''),url]));
export function upgradeImage(key){return upgradeImages[key]||upgradeImages['damage-melee'];}
export const upgradeArtIcon=key=>`<img class="upgrade-art-icon" src="${upgradeImage(key)}" alt="" width="40" height="40" draggable="false">`;

