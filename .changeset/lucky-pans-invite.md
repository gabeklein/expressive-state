---
'@expressive/mvc': minor
---

Pools can shape or decline what `add` produces.

`has(Player, 'id')` names a field to receive `add`'s argument, covering the common transposition without a function. A lone instance is still admitted rather than constructed.

A factory returning `undefined` or `null` now adds nothing and `add` yields it back - so a factory may look a member up, filter one out, or build it. Member type excludes nullish, so only `add` widens.
