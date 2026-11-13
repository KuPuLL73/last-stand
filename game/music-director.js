import {MenuMusic} from './menu-music.js';
const battleTrackURL=new URL('./assets/audio/battle-theme.mp3',import.meta.url).href;

// Two loop players, one owner of transitions. Stop the old channel before
// requesting the new one; each player guards late play() promises separately.
export class MusicDirector{
 constructor({lobby=new MenuMusic(),battle=new MenuMusic({src:battleTrackURL,id:'battle-music'})}={}){
  this.lobby=lobby;this.battle=battle;
 }
 sync({phase,enabled,paused=false}){
  const lobby=phase==='ready',battle=phase==='playing'||phase==='upgrade';
  const state=wanted=>({enabled,inMenu:wanted,paused});
  if(lobby){this.battle.setState(state(false));this.lobby.setState(state(true));}
  else{this.lobby.setState(state(false));this.battle.setState(state(battle));}
 }
 unlock(){this.lobby.unlock();this.battle.unlock();}
 setVolume(value){this.lobby.setVolume(value);this.battle.setVolume(value);}
 pause(){this.lobby.pause();this.battle.pause();}
 dispose(){this.lobby.dispose();this.battle.dispose();}
}
