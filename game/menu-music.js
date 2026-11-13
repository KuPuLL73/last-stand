const menuTrackURL = new URL('./assets/audio/menu-theme.mp3', import.meta.url).href;

// One media element for the lobby. Playback is unlocked by the caller's user
// gesture; game/platform state remains the single source of when it may play.
export class MenuMusic {
 constructor({ src = menuTrackURL, volume = .32, id = 'menu-music' } = {}) {
  this.audio = new Audio();
  this.audio.id = id;
  this.audio.hidden = true;
  this.audio.setAttribute('aria-hidden', 'true');
  this.audio.src = src;
  this.audio.preload = 'none';
  this.audio.loop = true;
  this.audio.volume = 0;
  globalThis.document?.body?.append(this.audio);
  this.volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : .32;
  this.enabled = false;
  this.inMenu = false;
  this.paused = false;
  this._wanted = false;
  this._unlocked = false;
  this._blocked = false;
  this._disposed = false;
  this._generation = 0;
  this._pending = null;
  this._fade = null;
  this._fadeProgress = 0;
  this._raf = globalThis.requestAnimationFrame?.bind(globalThis)
   || (callback => setTimeout(() => callback(performance.now()), 16));
  this._caf = globalThis.cancelAnimationFrame?.bind(globalThis) || clearTimeout;
  this._status('idle');
 }

 setVolume(value) {
  if (Number.isFinite(value)) this.volume = Math.max(0, Math.min(1, value));
  if (!this._disposed) this.audio.volume = this._wanted && !this.audio.paused
   ? this.volume * this._fadeProgress : 0;
  return this.volume;
 }

 setState({ enabled, inMenu, paused = false }) {
  if (this._disposed) return;
  this.enabled = Boolean(enabled);
  this.inMenu = Boolean(inMenu);
  this.paused = Boolean(paused);
  const wanted = this.enabled && this.inMenu && !this.paused;
  const changed = wanted !== this._wanted;
  this._wanted = wanted;
  if (!wanted) {
   if (changed) this._stop();
   else if (!this._pending) this._status('paused');
   return;
  }
  if (changed) this._blocked = false;
  this._sync();
 }

 // Call directly from pointerdown/keydown, not after awaiting another task.
 unlock() {
  if (this._disposed) return;
  this._unlocked = true;
  this._blocked = false;
  this._sync();
 }

 pause() {
  if (this._disposed) return;
  this._wanted = false;
  this._stop();
 }

 dispose() {
  if (this._disposed) return;
  this.pause();
  this._disposed = true;
  this.audio.removeAttribute('src');
  this.audio.load();
  this.audio.remove();
  this._status('disposed');
 }

 _status(value) { this.audio.dataset.menuMusicState = value; }

 _stop() {
  this._generation++;
  if (this._fade !== null) this._caf(this._fade);
  this._fade = null;
  this._fadeProgress = 0;
  this.audio.pause();
  this.audio.volume = 0;
  // Keep currentTime. Returning to the lobby resumes the same track position.
  this._status('paused');
 }

 _sync() {
  if (this._disposed || !this._wanted) return;
  if (!this._unlocked) { this._status('locked'); return; }
  if (this._pending || this._blocked || !this.audio.paused) return;
  const attempt = { generation: this._generation };
  this._pending = attempt;
  this._fadeProgress = 0;
  this.audio.volume = 0;
  this._status('pending');
  let playback;
  try { playback = this.audio.play(); }
  catch (error) { playback = Promise.reject(error); }
  Promise.resolve(playback).then(() => {
   if (this._disposed || !this._wanted || attempt.generation !== this._generation) {
    // A late play() fulfillment must never start music over the battle. New
    // attempts wait for this one to settle, so stopping it cannot stop a newer one.
    this.audio.pause();
    this.audio.volume = 0;
    this._status(this._disposed ? 'disposed' : 'paused');
    return;
   }
   this._status('playing');
   this._fadeIn(attempt.generation);
  }, error => {
   if (this._disposed || !this._wanted || attempt.generation !== this._generation) return;
   this._blocked = true;
   this._status(error?.name === 'NotAllowedError' ? 'blocked' : 'error');
  }).finally(() => {
   if (this._pending === attempt) this._pending = null;
   if (this._wanted && !this._disposed && !this._blocked && this.audio.paused) this._sync();
  });
 }

 _fadeIn(generation) {
  if (this._fade !== null) this._caf(this._fade);
  const start = performance.now();
  const step = now => {
   this._fade = null;
   if (this._disposed || !this._wanted || generation !== this._generation) return;
   const progress = Math.max(0, Math.min(1, (now - start) / 600));
   this._fadeProgress = progress;
   this.audio.volume = this.volume * progress;
   if (progress < 1) this._fade = this._raf(step);
  };
  this._fade = this._raf(step);
 }
}
