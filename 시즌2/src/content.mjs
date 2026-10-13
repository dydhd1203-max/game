// Season 2 test expedition: village → forest beacon → first boss.
// Changed village collision layout requires matching multiplayer clients.
// Earlier local checkpoints are explicitly migrated when loaded.
export const BUILD = 's2-004';
// Art-only release; collision, simulation and save/network protocol stay s2-004.
export const RELEASE = 's2-005';
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
  workshop:{x:-10.5,z:8,r:6}, wagon:{x:11,z:5,r:6},
  assembly:{x:-10,z:27,r:5}, market:{x:10,z:21,r:5},
  smithYard:{x:-11,z:18,r:3.4}, supplyYard:{x:13,z:13.5,r:3.1}
};
// The same eight village trees frame the street closer to its buildings.
// Radius covers the leaning trunk; the canopy is overhead, not a solid wall.
export const VILLAGE_GROVE = [
  {x:-19.5,z:3,r:.85,h:9.3},{x:20.5,z:4,r:.85,h:9.0},
  {x:-20,z:12,r:.85,h:9.8},{x:21,z:13,r:.85,h:9.5},
  {x:-20.5,z:22,r:.85,h:9.4},{x:20,z:23,r:.85,h:9.8},
  {x:-19.5,z:32,r:.85,h:8.8},{x:21,z:32,r:.85,h:9.2}
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
  if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>31-r||z>35-r||z < -137+r)return false;
  if(z < -18 && z > -90 && Math.abs(x)>19-r)return false;
  return !OBSTACLES.some(o=>Math.hypot(x-o.x,z-o.z)<o.r+r);
}
export function zoneAt(x,z,stage){return ZONES.find(a=>a.stage<=stage&&Math.hypot(x-a.x,z-a.z)<a.r-1);}
