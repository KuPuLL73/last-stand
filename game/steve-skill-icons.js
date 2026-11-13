import bow from './assets/hud/bow.png?url';
import feather from './assets/steve-ranged/feather.png?url';
import shield from './assets/boosts/shield.png?url';
const images={bow,dash:feather,bulwark:shield};
export const steveSkillImage=id=>images[id]||bow;
export const steveSkillIcon=id=>`<img class="skill-item" src="${steveSkillImage(id)}" alt="" width="64" height="64" draggable="false">`;
