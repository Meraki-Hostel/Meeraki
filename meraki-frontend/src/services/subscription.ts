import { repository } from './repository';

/**
 * Change feed for the UI layer. Mock implementation forwards repository
 * changes; an HTTP adapter could forward websocket/SSE events instead.
 */
export const subscribeToData = (fn: () => void) => repository.subscribe(fn);
export const dataRecoveredFromCorruption = () => repository.recoveredFromCorruption;
