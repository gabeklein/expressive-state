---
"@expressive/mvc": minor
"@expressive/react": minor
---

Deferred presentation moves to `Component.act(work)`, replacing the free `transition()` export (removed).

Work marked this way is non-urgent, so React keeps current content on screen while a replacement gets ready rather than falling back. The returned promise settles once that work is **presented** - after a suspended replacement commits - so a caller can hold a pending flag across the wait. Writes inside are ordinary and may target any state, owned or not.

`Component` is the only host that can report progress: React tracks a transition through the hook that started it, so observing one requires a render to schedule through. The adapter mounts that hook above each component, where its own re-renders leave the content's element untouched - hosting it any lower would rebuild that content on every pending change and defeat the deferral. Before mount, or on a host without `useTransition`, work still defers and the promise settles on dispatch.

Note that mvc writes are immediate and only notification defers, so a component which reads a pending flag must not rebuild the deferred content on the same pass - read it from a sibling, or from a wrapper taking that content as `children`.

Migrating: `transition(() => …)` becomes `component.act(() => …)`. Hosts report presentation by returning a promise from `HostRuntime.transition`; returning nothing behaves as before.
