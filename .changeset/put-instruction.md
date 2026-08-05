---
"@expressive/mvc": minor
"@expressive/react": minor
---

Add `put` - an instruction for unmanaged instance storage. The property is a plain writable own value: reads and writes use normal property syntax, never notify subscribers, and never throw after destroy. Excluded from snapshots, iteration, and `ref(this)`, but assignable from an overlay (constructor argument, `set({ ... })`, or Component props).

For subscription handles, side-pocket data, and comparison tokens - state the UI observes stays in a managed field.
