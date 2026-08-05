---
"@expressive/mvc": patch
"@expressive/router": patch
---

A `State` landing in a managed property is now adopted by whichever path stores it, not only by direct assignment. A child produced by a `set()` factory, or assigned to a property which started empty, is parented, registered in its owner's context, activated, and destroyed with its owner.

Values derived by a getter or computed are unaffected - derivation reads a reference and does not confer ownership.

Fixes the `Route.router` fallback in `@expressive/router`, where a `Router` constructed for a route with none in context was never activated.
