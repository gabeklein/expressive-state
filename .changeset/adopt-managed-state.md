---
"@expressive/mvc": patch
"@expressive/router": patch
---

A `State` stored by an owning writer is now adopted regardless of how it arrives, not only by direct assignment at define time. A child produced by a `set()` factory, or assigned to a property which started empty - including a `Component` prop - is parented, registered in its owner's context, activated, and destroyed with its owner.

Ownership still follows freshness: an already-active `State` is registered as a guest and outlives the property, matching `map()`. Values a state only reads - a getter, a computed, or a type resolved from context by `get(Type)` - are not adopted; reading a reference does not confer ownership.

Fixes the `Route.router` fallback in `@expressive/router`, where a `Router` constructed for a route with none in context was never activated.
