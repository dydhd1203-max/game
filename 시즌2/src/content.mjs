// Season 2 test expedition: village → forest beacon → first boss.
// Changed village collision layout requires matching multiplayer clients.
// Local s2-001 checkpoints are explicitly migrated when loaded.
export const BUILD = 's2-002';
export const RELEASE = 's2-002';
export const SEASON = 2;
// Dedicated reserved subtree of the existing classroom backend. Season 1 room
// codes are uppercased; they never address this lowercase reserved path.
export const DB_ROOT = 'sheepnight/season2_v1/rooms';
export const TEAM_COLORS = [0xff6b6b, 0x4dabf7, 0x51cf66, 0xffd43b, 0xcc7bff];
export const SPAWN = {x:0,z:25};
export const BEACON = {x:0,z:-64};
export const GATE = {x:0,z:-91};
export const BOSS_HOME = {x:0,z:-115};
export const ZONES = [
  {id:'trail',x:0,z:-28,r:12,stage:0},
  {id:'beacon',x:0,z:-65,r:13,stage:1},
  {id:'boss-left',x:-15,z:-109,r:9,stage:2},
  {id:'boss-right',x:15,z:-109,r:9,stage:2}
];
// Art and collision share these positions: the workshop frames the forest road,
// the wagon sits behind the market, and the middle remains wide enough for 21.
export const VILLAGE_SITES = {
  workshop:{x:-12,z:9,r:6}, wagon:{x:15,z:6,r:6},
  assembly:{x:-13,z:28,r:5}, market:{x:13,z:22,r:5}
};
export const OBSTACLES = [
  ...Object.values(VILLAGE_SITES),
  {x:-12,z:-44,r:3},{x:13,z:-47,r:3},
  {x:-13,z:-76,r:3},{x:13,z:-79,r:3}
];
export const TOWERS = {
  arrow:{name:'화살탑',cost:40,range:18,hp:180,damage:16,interval:.85},
  ice:{name:'얼음탑',cost:55,range:14,hp:160,damage:8,interval:1.2}
};
export function walkable(x,z,r=.6){
  if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>31-r||z>35-r||z < -137+r)return false;
  if(z < -18 && z > -90 && Math.abs(x)>19-r)return false;
  return !OBSTACLES.some(o=>Math.hypot(x-o.x,z-o.z)<o.r+r);
}
export function zoneAt(x,z,stage){return ZONES.find(a=>a.stage<=stage&&Math.hypot(x-a.x,z-a.z)<a.r-1);}
