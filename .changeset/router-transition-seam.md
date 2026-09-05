---
"@expressive/router": minor
---

Navigation now commits through a protected `Router.transition` seam, defaulting to the host scheduler's non-urgent bracket (React `startTransition`). In-app navigation to a page that isn't ready - a loading lazy chunk, a pending async entry guard - holds the current screen until the next is ready instead of flashing the route's `fallback`. Cold load still shows `fallback`; the URL updates immediately either way. Subclasses may override `transition(commit)` to stage the swap (e.g. View Transitions).
