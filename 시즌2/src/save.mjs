import {BUILD} from './content.mjs';
import {restoreVillagePositions} from './sim.mjs';
import {ensureSeason1Motion} from './locomotion-season1.mjs';

// This migrates only a local checkpoint. Online room versions stay strict so
// students never see a different walkable map from the authoritative host.
export function migrateCheckpoint(saved) {
  if (!saved || saved.season!==2 || !['s2-001','s2-002','s2-003','s2-004',BUILD].includes(saved.version) ||
      saved.state?.version!==saved.version || !saved.state.players) return null;
  const next=JSON.parse(JSON.stringify(saved.state));
  next.version=BUILD;
  // Retired shared construction must not return from a saved deployed/carried
  // tower or a retry checkpoint. Only the detached runtime copy is migrated;
  // the source save and its supplies/progress remain untouched.
  next.towers=[];
  if(next._checkpoint && typeof next._checkpoint==='object')next._checkpoint.towers=[];
  if(next.message==='봉화가 켜졌어요! 얼음 + 화살 조합으로 앞길을 정리하고 숲길 입구로 가요.')
    next.message='봉화가 켜졌어요! 앞길의 좀비를 정리하고 숲길 입구로 가요.';
  for(const p of Object.values(next.players))ensureSeason1Motion(p);
  restoreVillagePositions(next);
  return next;
}
