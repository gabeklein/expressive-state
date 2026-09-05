import { owns } from '@expressive/mvc/runtime';

import { Runtime } from './runtime';

interface Driver {
  start(work: () => void): void;
  waiting: (() => void)[];
}

/** Release anything waiting on this driver - it has nothing left to report. */
function settle(driver: Driver) {
  for (const resolve of driver.waiting.splice(0)) resolve();
}

/**
 * Gives `owner` a scheduler React can report progress through - it tracks a
 * transition by the hook which started it, so deferring from outside render
 * still needs one minted in it.
 *
 * A frame of its own because this re-renders whenever pending flips: the
 * component below rebuilds its content every render (that is how updates
 * arrive), and rebuilding it here would read the already-written value and
 * suspend, defeating the deferral. Re-rendering leaves `children` identical
 * instead, so the content bails out.
 */
export function Driver(props: { owner: object; children: unknown }) {
  const [pending, start] = Runtime.useTransition!();
  const ref = Runtime.useRef<Driver | null>(null);
  const driver = ref.current || (ref.current = { start, waiting: [] });

  driver.start = start;

  Runtime.useEffect(() => {
    const release = owns(props.owner, (work) =>
      new Promise<void>((resolve) => {
        driver.waiting.push(resolve);
        driver.start(work);
      })
    );

    return () => {
      release();
      settle(driver);
    };
  }, []);

  Runtime.useEffect(() => {
    if (!pending) settle(driver);
  }, [pending]);

  return props.children;
}
