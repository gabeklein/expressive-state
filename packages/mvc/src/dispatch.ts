type Handler = () => void;
type Transition = (work: Handler) => void;

interface Pending {
  count: number;
  done(): void;
}

interface Scheduled {
  /** How this subscriber defers, if it can - supplied where it subscribed. */
  transition?: Transition;
  /** Whether this update is deferred - decided by the call which queued it. */
  deferred?: boolean;
  awaiting?: Set<Pending>;
  holds: number;
}

const DISPATCH = new Map<Handler, Scheduled>();
const RESOLVED = Promise.resolve();

let current: Set<Pending> | undefined;
let replaying: Scheduled | undefined;

/**
 * Await this handler's replay for the work being scheduled. Overlapping calls
 * may each be waiting on the same handler, which replays once.
 */
function claim(scheduled: Scheduled) {
  if (!current) return;

  const awaiting = scheduled.awaiting || (scheduled.awaiting = new Set());

  for (const record of current)
    if (!awaiting.has(record)) {
      awaiting.add(record);
      record.count++;
    }
}

function drop(scheduled: Scheduled) {
  const { awaiting } = scheduled;

  if (!awaiting) return;

  scheduled.awaiting = undefined;

  for (const record of awaiting)
    if (!--record.count) record.done();
}

/**
 * Hold the work being replayed until the returned callback runs - a subscriber
 * which has not yet absorbed the update takes one, and settlement waits on it
 * rather than on the replay. Returns nothing where the replay is not deferred,
 * so a subscriber pays for this only where work was scheduled.
 */
function hold() {
  const scheduled = replaying;

  if (!scheduled?.awaiting) return;

  let released = false;

  scheduled.holds++;

  return () => {
    if (released) return;
    released = true;
    if (!--scheduled.holds) drop(scheduled);
  }
}

function flush() {
  for (const [handler, scheduled] of DISPATCH) {
    DISPATCH.delete(handler);

    const { deferred, transition } = scheduled;
    const parent = current;
    const outer = replaying;

    current = scheduled.awaiting;
    replaying = scheduled;

    try {
      if (deferred && transition) transition(handler);
      else handler();
    } catch (err) {
      console.error(err);
    } finally {
      current = parent;
      replaying = outer;
    }

    if (!scheduled.holds) drop(scheduled);
  }
}

/**
 * Queue `handler` to replay after this tick. `transition` is how this
 * subscriber defers - it brackets the replay, but only where the scheduled
 * work asked for one.
 */
function enqueue(handler: Handler, transition?: Transition) {
  if (!DISPATCH.size) queueMicrotask(flush);

  const scheduled = DISPATCH.get(handler);

  if (!scheduled) {
    const next: Scheduled = { transition, deferred: !!current, holds: 0 };

    DISPATCH.set(handler, next);
    claim(next);
  } else if (current) {
    claim(scheduled);
  } else {
    scheduled.deferred = false;
    drop(scheduled);
  }
}

/**
 * Run `work` now, marking the subscriber updates it queues non-urgent - each
 * replays through whatever scheduler it subscribed with. The callback itself is
 * synchronous; only what it notifies is pending.
 *
 * Resolves once every one of those updates has replayed and been absorbed. A
 * subscriber which cannot report absorption resolves on replay; one which can
 * defer brackets its own replay.
 */
function pending(work: Handler): Promise<void>;

/**
 * Declare the subscriber currently replaying has not absorbed its update yet -
 * settlement waits on the returned callback rather than on the replay. Call
 * only from inside a replay: anywhere else, and where the replay is not
 * deferred, this returns nothing and the subscriber pays for none of it.
 */
function pending(): (() => void) | undefined;

function pending(work?: Handler) {
  if (!work) return hold();

  if (current) {
    work();
    return RESOLVED;
  }

  const scheduled: Scheduled = { holds: 0 };
  const promise = new Promise<void>((resolve) => {
    scheduled.awaiting = current = new Set([{ count: 1, done: resolve }]);
  });

  try {
    work();
  } finally {
    current = undefined;
  }

  drop(scheduled);

  return promise;
}

export { enqueue, pending };
