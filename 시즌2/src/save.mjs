import {BUILD} from './content.mjs';
import {restoreVillagePositions} from './sim.mjs';
import {ensureSeason1Motion} from './locomotion-season1.mjs';

// This migrates only a local checkpoint. Online room versions stay strict so
// students never see a different walkable map from the authoritative host.
export function migrateCheckpoint(saved) {
  if (!saved || saved.season!==2 || !['s2-001','s2-002','s2-003',BUILD].includes(saved.version) ||
      saved.state?.version!==saved.version || !saved.state.players) return null;
  const next=JSON.parse(JSON.stringify(saved.state));
  next.version=BUILD;
  for(const p of Object.values(next.players))ensureSeason1Motion(p);
  restoreVillagePositions(next);
  return next;
}
