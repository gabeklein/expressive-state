import type { Component } from './component';
import { schedule } from './dispatch';

/**
 * Per-adapter interpretation manifest. Each adapter augments this interface to
 * declare how it renders; the first member is `node` - the element type produced
 * by `Component.render` (surfaced as `Component.Node`) - alongside `intrinsics`,
 * the host's tag map (surfaced as `JSX.IntrinsicElements`).
 *
 * ```ts
 * declare module '@expressive/mvc/runtime' {
 *   interface Host {
 *     node: React.ReactNode;
 *     intrinsics: React.JSX.IntrinsicElements;
 *   }
 * }
 * ```
 *
 * Only one adapter is expected per compilation; two augmenting the same member
 * with different types in the same build would conflict - by design.
 */
export interface Host { }

/**
 * Host runtime, registered by an adapter (e.g. `@expressive/react`) as an
 * import side effect. One host per build - a second registration with a
 * different runtime throws.
 *
 * Members are ambient host capabilities: plain functions the host uniquely
 * owns, callable outside render - element mechanics always, plus optional
 * extras that fall back sanely when absent. Hook-shaped (render-resident)
 * capabilities do not belong here; those live with the adapter.
 */
export interface HostRuntime {
  childrenOf(children: unknown): Component.Node[];
  isElement(node: unknown): boolean;
  jsx(type: unknown, props: object, key?: unknown): Component.Node;
  jsxDEV?(type: unknown, props: object, key?: unknown, isStatic?: boolean, source?: object, self?: unknown): Component.Node;
  jsxs(type: unknown, props: object, key?: unknown): Component.Node;
  propsOf(node: unknown): Record<string, unknown>;
  typeOf(node: unknown): unknown;
  /** Non-urgent update bracket (e.g. React `startTransition`). Optional. Return
   * a promise settling when the bracketed work is presented to report progress;
   * return nothing to opt out. */
  transition?(work: () => void): void | Promise<void>;
  Fragment: unknown;
}

/**
 * Agnostic Fragment sentinel. The runtime entries translate it to the host's
 * Fragment on element creation; `typeOf` translates back, so identity checks
 * against this value hold for fragments from either pragma.
 */
export const Fragment = Symbol.for('@expressive/mvc.Fragment');

/** Default for seams only a registered host can provide. */
function absent(): never {
  throw new Error(
    'No JSX host is registered for @expressive/mvc. ' +
    "Import a host adapter (e.g. '@expressive/react') before anything renders - " +
    'typically as the first import of your application entry module.'
  );
}

const HOST: HostRuntime = {
  childrenOf: absent,
  isElement: absent,
  jsx: absent,
  jsxs: absent,
  propsOf: absent,
  typeOf: absent,
  Fragment
};

let registered: HostRuntime | undefined;

/**
 * Register the host runtime. Idempotent for the same runtime - re-registering
 * picks up members added since (e.g. an optional dev or scheduler seam).
 * Element mechanics the host leaves unset keep defaults that throw a
 * setup-pointing error; the optional seams (`jsxDEV`, `transition`) are
 * routed around at the call sites instead.
 */
export function host(runtime: HostRuntime) {
  if (registered && registered !== runtime)
    throw new Error(
      'A different JSX host is already registered for @expressive/mvc. ' +
      'Only one host adapter may be active per build.'
    );

  registered = runtime;
  Object.assign(HOST, runtime);
}

/** Translate the agnostic Fragment sentinel to the host's Fragment. */
function hostType(type: unknown): unknown {
  return type === Fragment ? HOST.Fragment : type;
}

export function jsx(type: unknown, props: object, key?: unknown): Component.Node {
  return HOST.jsx(hostType(type), props, key);
}

export function jsxs(type: unknown, props: object, key?: unknown): Component.Node {
  return HOST.jsxs(hostType(type), props, key);
}

/** Dev-transpiled element creation. Hosts without a `jsxDEV` of their own fall
 * back to the production entries (prod-only host under a dev build). */
export function jsxDEV(
  type: unknown,
  props: object,
  key?: unknown,
  isStatic?: boolean,
  source?: object,
  self?: unknown
): Component.Node {
  return HOST.jsxDEV
    ? HOST.jsxDEV(hostType(type), props, key, isStatic, source, self)
    : isStatic
      ? jsxs(type, props, key)
      : jsx(type, props, key);
}

/** Flatten `children` to an array of nodes, per the host's semantics. */
export function childrenOf(children: unknown): Component.Node[] {
  return HOST.childrenOf(children);
}

/** Is `node` a host element? */
export function isElement(node: unknown): boolean {
  return HOST.isElement(node);
}

/** Element type of `node`; host Fragments surface as the agnostic `Fragment`. */
export function typeOf(node: unknown): unknown {
  const type = HOST.typeOf(node);
  return type === HOST.Fragment ? Fragment : type;
}

/** Props carried by element `node`. */
export function propsOf(node: unknown): Record<string, unknown> {
  return HOST.propsOf(node);
}

const OWNED = new WeakMap<object, HostRuntime['transition']>();

/**
 * Give `owner` a scheduler of its own, which {@link Component.act} will
 * prefer over the ambient one. An adapter installs this from a render, the only
 * place a host can observe its own deferred work.
 */
export function owns(owner: object, transition: HostRuntime['transition']) {
  OWNED.set(owner, transition);
  return () => void OWNED.delete(owner);
}

/**
 * Mark synchronous work as non-urgent. `work` runs inline through the host
 * scheduler; queued subscriber updates inherit the designation and replay it
 * after dispatch. Without a host scheduler, normal timing is retained.
 *
 * Resolves when those updates have been presented - on dispatch where the host
 * (or `owner`) cannot report it.
 */
export function transition(work: () => void, owner?: object): Promise<void> {
  return schedule(work, (owner && OWNED.get(owner)) || HOST.transition);
}
