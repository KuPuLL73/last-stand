const WORLD_DIAMETER_PER_RADIUS = 2.36;

const bossArt = {
  'iron-golem': 'earth',
  wither: 'shadow',
  warden: 'sonic',
  'elder-guardian': 'shield',
  'zombie-brute': 'earth',
  'ender-dragon': 'dragon',
};

const pickupArt = {heal: 'heal', haste: 'dash', rapid: 'muzzle', shield: 'shield', magnet: 'xp'};

/** Route game events to world sprites. Combat shapes and timings come from the run. */
export function playCombatPixelFx(effects, event, state, reducedMotion) {
  const player = state.player;
  const {x, z} = event;
  const play = (kind, options) => effects.pixel(kind, {x, z, reducedMotion, ...options});
  const floor = (kind, radius, duration, priority = 1, origin = {}) => play(kind, {
    size: radius * WORLD_DIAMETER_PER_RADIUS, y: .07, ground: true, duration, priority, ...origin,
  });
  const directional = (kind, size, duration, priority = 1, y = .78) => {
    const dx = event.dx ?? player.aimX;
    const dz = event.dz ?? player.aimZ;
    return play(kind, {
      x: x + dx * size * .25, z: z + dz * size * .25, y, size, duration, priority,
      ground: true, rotation: Math.atan2(dx, dz),
    });
  };

  switch (event.type) {
    case 'meleeimpact': {
      const range = event.range;
      const width = Math.max(.9, 2 * range * Math.sin(Math.min(Math.PI, event.arc) / 2));
      return play('slash', {
        x: x + event.dx * range * .57, z: z + event.dz * range * .57,
        y: .68, width: range * 1.22, height: width * 1.15,
        ground: true, rotation: event.angle, duration: event.echo ? .22 : .27,
      });
    }
    case 'shot': return directional('muzzle', .95, .16);
    case 'bowshot': return directional('ricochet', .72, .18, 0);
    case 'rangedshot': {
      if (event.kind === 'ember') return directional('fire', 1.1, .22);
      if (event.kind === 'snowball') return directional('frost', .84, .21);
      return directional(event.kind === 'bolt' ? 'muzzle' : 'ricochet', .9, .17);
    }
    case 'enemyshot': {
      const kind = event.kind === 'wither-skull' ? 'shadow' : event.kind?.includes('dragon') ? 'dragon' : 'impact';
      return play(kind, {y: event.boss ? 1.55 : .9, size: event.boss ? 1.6 : .65, duration: .22, priority: 0});
    }
    case 'hit': {
      if (event.hp <= 0 || event.cause === 'rot' || event.cause === 'combo') return false;
      return play('impact', {y: .96, size: event.damage >= 60 ? 1.05 : .72, duration: .22, priority: 0});
    }
    case 'ricochet': return play('ricochet', {y: .67, size: .72, duration: .24, priority: 0});
    case 'frosthit': return floor('frost', .61, .38);
    case 'emberblast': return floor('fire', event.radius || .55, .38);
    case 'kill': return play('death', {y: event.enemyType === 'boss' ? 1.15 : .75, size: event.enemyType === 'boss' ? 2.65 : 1.08, duration: .44, priority: event.enemyType === 'boss' ? 3 : 0});
    case 'split': return play(event.variant?.includes('magma') ? 'fire' : 'poison', {y: .38, size: 1.03, duration: .35});
    case 'teleport': {
      play('warp', {x: event.fromX, z: event.fromZ, y: .9, size: 1.24, duration: .3});
      return play('warp', {y: .95, size: 1.38, duration: .43});
    }
    case 'pickup': return event.dropType === 'xp' && play('xp', {y: .40, size: .66, duration: .28, priority: 0});
    case 'bonus': return play(pickupArt[event.bonus] || 'pickup', {y: .85, size: 1.72, duration: .54, priority: 2});
    case 'upgrade': return play('pickup', {x: player.x, z: player.z, y: .9, size: 1.7, duration: .52, priority: 2});
    case 'debuff': return play(event.debuff === 'poison' ? 'poison' : 'frost', {
      x: player.x, z: player.z, y: .66, size: 1.2, duration: .45, priority: 2,
    });
    case 'hurt': return play('impact', {x: player.x, z: player.z, y: .95, size: .9, duration: .22, priority: 1});
    case 'reflect': return directional('shield', 1.05, .32, 2);
    case 'dashend': return floor('dash', .68, .28, 1);
    case 'chargeend': return floor('earth', .9, .37);
    case 'super': {
      if (event.ability === 'dash') return directional('dash', 2.1, .36, 2, .48);
      if (event.ability === 'bulwark') return play('shield', {y: .84, size: 2.4, duration: .48, priority: 2});
      if (event.ability === 'bow') return play('pickup', {y: .9, size: 1.9, duration: .42, priority: 2});
      return directional('muzzle', 2.25, .28, 3);
    }
    case 'boss': return play(bossArt[event.bossVariant] || 'earth', {y: 1.05, size: 2.6, duration: .62, priority: 3});
    case 'bossdefeated': return play('pickup', {x: player.x, z: player.z, y: 1, size: 2.35, duration: .67, priority: 3});
    case 'bossability': {
      const kind = bossArt[event.bossVariant] || 'earth';
      if (event.stage === 'phase') return play(kind, {y: 1.15, size: 2.65, duration: .62, priority: 3});
      if (event.stage !== 'fire') return false;
      if (event.shape === 'line') {
        // Punctuate the beam while leaving its narrow telegraph and centerline visible.
        for (const fraction of [.32, .68, 1]) {
          play(kind, {
            x: event.fromX + (x - event.fromX) * fraction,
            z: event.fromZ + (z - event.fromZ) * fraction,
            y: event.fromY || .8, size: Math.max(.58, (event.width || .8) * 1.05), duration: .31, priority: 3,
          });
        }
        return true;
      }
      if (event.shape === 'ring' && event.innerRadius > 0) {
        const middle = (event.radius + event.innerRadius) / 2;
        const band = (event.radius - event.innerRadius) / 2;
        for (let i = 0; i < 6; i++) {
          const angle = i * Math.PI / 3;
          floor(kind, Math.min(.78, band), .41, 3, {x: x + Math.sin(angle) * middle, z: z + Math.cos(angle) * middle});
        }
        return true;
      }
      if (event.shape === 'circle' && event.radius > 0) {
        return floor(kind, Math.min(event.radius, 3.2), .51, 3);
      }
      if (Number.isFinite(event.dx) && Number.isFinite(event.dz)) {
        return directional(kind, 2.2, .42, 3, 1);
      }
      return play(kind, {y: 1.1, size: 1.85, duration: .41, priority: 3});
    }
    case 'slam': {
      if (event.bossAbility) return false;
      return floor(event.explosion ? 'fire' : 'earth', Math.min(event.radius || 1.6, 3.2), .48, 2);
    }
    default: return false;
  }
}

/** Sparse accents keep long burns and frost visible in a crowd. */
export function playStatusPixelFx(effects, state, limit) {
  const {player} = state;
  for (const enemy of state.enemies) {
    if (limit <= 0) break;
    if (enemy.hp <= 0 || Math.hypot(enemy.x - player.x, enemy.z - player.z) > 8) continue;
    const kind = enemy.burn > .18 ? 'fire' : enemy.slowTime > .18 ? 'frost' : null;
    if (!kind) continue;
    const size = Math.min(1.35, 1.4 * enemy.radius + .24);
    effects.pixel(kind, {x:enemy.x,z:enemy.z,y:.34,size,opacity:.65,duration:.27,priority:0});
    limit--;
  }
}
