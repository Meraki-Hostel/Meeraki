import { lazy, type ComponentType } from 'react';

/** React.lazy for named exports, so feature modules stay code-split per role. */
export function lazyNamed<M extends Record<string, unknown>, K extends keyof M>(loader: () => Promise<M>, name: K) {
  return lazy(async () => ({ default: (await loader())[name] as ComponentType }));
}
