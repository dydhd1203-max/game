// Season 2 test expedition: village → forest beacon → first boss.
// Compact village plots change collision geometry; peers must use matching maps.
// Earlier local checkpoints are explicitly migrated when loaded.
export const BUILD = 's2-008';
// Nature art revision only; collision, saves and network remain s2-008.
export const RELEASE = 's2-009';
export const SEASON = 2;
// Dedicated reserved subtree of the existing classroom backend. Season 1 room
// codes are uppercased; they never address this lowercase reserved path.
export const DB_ROOT = 'sheepnight/season2_v1/rooms';
export const TEAM_COLORS = [0xff6b6b, 0x4dabf7, 0x51cf66, 0xffd43b, 0xcc7bff];
export const SPAWN = {x:0,z:19};
// A 41 × 42.5m village replaces the unused 62 × 53m lawn.
export const VILLAGE_BOUNDS = Object.freeze({halfWidth:20.5,south:29.5,north:-13});
export function mapHalfWidth(z){
  if(z>=VILLAGE_BOUNDS.north)return VILLAGE_BOUNDS.halfWidth;
  if(z>-18)return 19+(z+18)/5*(VILLAGE_BOUNDS.halfWidth-19);
  return z>-90?19:31;
}
export const BEACON = {x:0,z:-64};
export const GATE = {x:0,z:-91};
export const BOSS_HOME = {x:0,z:-115};
// Art and collision share these positions: the workshop frames the forest road,
// the wagon sits behind the market, and the middle remains wide enough for 21.
export const VILLAGE_SITES = {
  workshop:{x:-10.5,z:4.5,r:6}, wagon:{x:10,z:3,r:5.4},
  assembly:{x:-9.4,z:24,r:4.8}, market:{x:9.5,z:14.2,r:4.9},
  smithYard:{x:-8.2,z:14.8,r:3.6}, supplyYard:{x:8.2,z:24,r:3.6}
};
// The same eight village trees frame the street closer to its buildings.
// Radius covers the leaning trunk; the canopy is overhead, not a solid wall.
export const VILLAGE_GROVE = [
  {x:-9,z:-7.8,r:.85,h:8.3},{x:9,z:-7.8,r:.85,h:8.6},
  {x:-18.2,z:11,r:.85,h:9.2},{x:18.2,z:11,r:.85,h:8.9},
  {x:-18,z:19.2,r:.85,h:8.5},{x:18,z:19.2,r:.85,h:9.1},
  {x:-17.6,z:27.5,r:.85,h:8.4},{x:17.6,z:27.5,r:.85,h:8.6}
];
// Forest geometry must not depend on the number of village plots.
export const FOREST_OBSTACLES = [
  {x:-12,z:-44,r:3},{x:13,z:-47,r:3},
  {x:-13,z:-76,r:3},{x:13,z:-79,r:3}
];
export const OBSTACLES = [...Object.values(VILLAGE_SITES),...VILLAGE_GROVE,...FOREST_OBSTACLES];
export const TOWERS = {
  arrow:{name:'화살탑',cost:40,range:18,hp:180,damage:16,interval:.85},
  ice:{name:'얼음탑',cost:55,range:14,hp:160,damage:8,interval:1.2}
};
export function walkable(x,z,r=.6){
  if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>mapHalfWidth(z)-r||z>VILLAGE_BOUNDS.south-r||z < -137+r)return false;
  return !OBSTACLES.some(o=>Math.hypot(x-o.x,z-o.z)<o.r+r);
}
