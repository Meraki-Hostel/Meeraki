import { repository } from './repository';
import { subscribeToHttpChanges } from './http/client';

/**
 * Change feed for the UI layer. Forwards both mock repository changes and
 * successful HTTP writes; a websocket/SSE feed could be added here later.
 */
export const subscribeToData = (fn: () => void) => {
  const offRepo = repository.subscribe(fn);
  const offHttp = subscribeToHttpChanges(fn);
  return () => { offRepo(); offHttp(); };
};
export const dataRecoveredFromCorruption = () => repository.recoveredFromCorruption;
