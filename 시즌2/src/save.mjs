import {BUILD} from './content.mjs';
import {restoreVillagePositions} from './sim.mjs';

// This migrates only a local checkpoint. Online room versions stay strict so
// students never see a different walkable map from the authoritative host.
export function migrateCheckpoint(saved) {
  if (!saved || saved.season!==2 || !['s2-001',BUILD].includes(saved.version) ||
      saved.state?.version!==saved.version || !saved.state.players) return null;
  const next=JSON.parse(JSON.stringify(saved.state));
  next.version=BUILD;
  restoreVillagePositions(next);
  return next;
}
