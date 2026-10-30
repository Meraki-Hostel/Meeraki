import { subscribeToHttpChanges } from './http/client';

/** Change feed for the UI layer: fires after every successful API write. */
export const subscribeToData = (fn: () => void) => subscribeToHttpChanges(fn);
