---
"@expressive/mvc": minor
"@expressive/react": minor
---

Deferred presentation arrives as `pending(work)`, replacing the free `transition()` export it supersedes.

The name describes the updates, not the callback: `work` runs immediately and synchronously, and the subscriber notifications it produces are what become pending. React therefore keeps current content on screen while a replacement gets ready rather than falling back. Writes may target any state. The returned promise settles once every subscriber the work touched has **absorbed** it: under React, once the update commits.

A free function rather than a method, because nothing about it is bound to one state. Settlement comes from whichever subscribers the writes happen to touch, so a receiver would only imply a scope that does not exist.

`pending` covers **mvc-driven updates**, not everything in the block. Each subscriber replays through the scheduler it subscribed with - `@expressive/react` supplies `startTransition`, a plain effect supplies nothing and keeps normal timing. One `pending()` call may have both, and neither is subjected to the other's semantics. A host is not required at all: with none registered the promise still settles once every subscriber has replayed, which makes it a headless barrier for the whole cascade.

Subscribers which cannot report absorption - unmounted, hidden inside an `Activity` tree, or a host with no scheduler - settle on replay rather than holding.

`pending()` with no arguments is the other half of the same feature. Called during a replay it returns a release callback, and settlement waits on that instead of on the replay returning; outside one it returns nothing. Adapters use it to hold until they commit, and a hand-written `watch` subscriber can participate on the same terms. It lives on the main entry rather than `@expressive/mvc/runtime`, which is for host seams - deferral no longer consults the host at all.

Note that a subscriber carries one update at one priority, so one which reads a progress flag must not rebuild the deferred content on the same pass - read it from a sibling, or from a wrapper taking that content as `children`.

Migrating: `transition(() => …)` becomes `pending(() => …)`. `HostRuntime.transition` is removed - a scheduler is passed to `watch` instead, by whoever subscribes.
