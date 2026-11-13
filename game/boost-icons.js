import heal from './assets/boosts/heal.png?url';
import haste from './assets/boosts/haste.png?url';
import rapid from './assets/boosts/rapid.png?url';
import shield from './assets/boosts/shield.png?url';
import magnet from './assets/boosts/magnet.png?url';
export const boostImages={heal,haste,rapid,shield,magnet};
// The 256px PNGs share createBoostGeometry() and its optional sphere shell.
export const boostIcon=id=>`<img class="boost-icon" src="${boostImages[id]}" alt="" width="40" height="40" draggable="false">`;
