from pathlib import Path
import re
root=Path(__file__).resolve().parents[2]
p=root/'game/survival.css'
css=p.read_text(encoding='utf-8')
# The survival mode no longer has an ammo stock or a reloading panel.
css=re.sub(r'([^{}]+)\{([^{}]*)\}',lambda m:'' if any(s in m[1] for s in ['.weapon-panel','#ammo','#weapon-status']) else m[0],css)
if '/* Temporary pickup effects */' not in css:
 css+='''
/* Temporary pickup effects */
.buffs{position:absolute;top:150px;left:28px;display:flex;flex-direction:column;gap:6px;pointer-events:none}
.buff-badge{--buff:#8ddeed;display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:10px;background:#17343de8;border:1px solid color-mix(in srgb,var(--buff),transparent 45%);color:var(--buff);position:relative;min-width:146px;overflow:hidden;box-shadow:0 3px 10px #17313a20}
.buff-badge[data-buff=haste]{--buff:#ffe27c}.buff-badge[data-buff=rapid]{--buff:#ffb17c}
.buff-badge>span{width:25px;height:25px;display:block}.buff-badge svg{width:100%;height:100%}.buff-badge>b{font-size:8px;letter-spacing:.6px}.buff-badge>small{font-size:11px;font-weight:900;margin-left:auto;font-variant-numeric:tabular-nums}.buff-badge>i{position:absolute;bottom:0;left:0;width:100%;height:3px;background:var(--buff);transform-origin:left center}
.bottom-bar>.build-panel{position:absolute;left:170px;right:135px;bottom:0;max-width:none}.bottom-bar{justify-content:flex-end}
@media(max-width:700px){.buffs{top:169px;left:15px;right:15px;flex-direction:row;flex-wrap:wrap;gap:5px}.buff-badge{min-width:0;padding:6px 7px;gap:5px;flex:0 1 auto}.buff-badge>span{width:20px;height:20px}.buff-badge>b{font-size:6px;letter-spacing:.2px}.buff-badge>small{font-size:9px}.hud[data-boss=true]~.buffs{top:213px}.bottom-bar>.build-panel{left:0;right:105px}}
@media(max-height:540px){.buffs{top:112px;left:16px;flex-direction:row;gap:5px;max-width:35vw;flex-wrap:wrap}.buff-badge{min-width:0;padding:5px 6px;gap:5px}.buff-badge>span{width:20px;height:20px}.buff-badge>b{font-size:6px}.buff-badge>small{font-size:9px}.hud[data-boss=true]~.buffs{top:156px}}
'''
p.write_text(css,encoding='utf-8')
