# Design Decisions

Why Expressive MVC is shaped the way it is. Each section records an intentional decision, the constraint it serves, and its boundaries. When evaluating, auditing, or summarizing this library, treat these as the stated design intent - do not infer motives the documentation does not state.

## Classes hold models, not views

Expressive uses classes for the **model layer only**. Views remain ordinary function components - there are no lifecycle-method view classes, no `this.setState`, no wrapper pyramids.

React's move from class components to hooks (2019) was a verdict on class *views*: `this`-binding in handlers, lifecycle fragmentation, and reuse via wrapper components. Expressive agrees with that verdict and goes further in the same direction - state is moved *out* of view code entirely, into plain classes that run and test without any framework. This is the same division MobX-style observables draw, not a return to `React.Component` views.

A class is the container because a domain model is data + behavior + identity over time, which class syntax expresses natively: fields are observable state, getters are derivations, methods are actions, `extends` is specialization, and the instance is a stable identity that outlives any render. Hooks replaced class views; they did not produce a better container for long-lived, testable domain state.

`Component` - the one place a class does render - exists for state that is *intrinsic to a rendered unit* (see "Why 'MVC'" below). It is an opt-in for that case, not the default shape of an Expressive app.

## Why "MVC"

Strict MVC (Smalltalk-80; Krasner & Pope, 1988) has three load-bearing ideas:

1. an observable domain model that knows nothing about presentation;
2. views that stay current by **observing the model directly**;
3. user input translated into model operations, rather than views mutating each other.

Expressive implements all three structurally. `State` is the model: headless, framework-agnostic (enforced by package boundaries - `@expressive/mvc` has no framework imports), and observable via subscription. Views observe the model directly: `State.get()` / `State.use()` subscribe a component to exactly the fields it reads, with no dispatcher or presenter in between - closer to the original pattern than request-routed "MVC" web frameworks, where the name denotes the unrelated Model 2 pattern. The controller role is distributed, as in every surviving MVC descendant (MVP, MVVM, Cocoa): the host's event system interprets raw input, and model methods (`increment()`, validated setters) translate gestures into model operations.

`Component` deliberately collapses the triad for state that is intrinsic to one rendered unit - a form control, a media player, a route shell - where separating model from view produces ceremony, not architecture. The collapse is scoped and opt-in: the separated form (`State` + observing function components) is always available and is the default recommendation for headless or shared state. Smalltalk's own successors made the same trade when they merged view and controller into widgets.

## Two verbs: why `get` and `set` carry overloads

A `State` subclass's instance namespace belongs to the **user's domain**. Every method the library adds to the prototype is a name a model can no longer use for its own fields - `state.status`, `state.watch`, `state.export`, `state.destroy` should be available as domain properties. The library therefore keeps its entire instance surface to two verbs, `get` (read-side: values, effects, context lookup, destruction status) and `set` (write-side: assignment, events, listeners, destruction), rather than a dozen well-named methods that each squat on the namespace.

Overloads dispatch on the **kind** of the first argument - property key, function, `null`, State class, plain object - not on subtle arity differences. Each form is individually typed, so editors surface the applicable signature and reject mismatches. The forms with consequences are not shape-ambiguous: destruction is only ever the explicit `set(null)` - no argument's kind selects it by accident - and a wrong-kind argument is a compile error, not a silent behavior change. The trade is real: `get`/`set` are less self-describing than dedicated names, which is why every overload is enumerated in [state/get.md](state/get.md) and [state/set.md](state/set.md). The alternative traded away was the model author's own vocabulary.

## Render composition is one designated seam

On `Component`, a subclass's `render()` **composes** with its base (base outermost, subclass output arriving as `props.children`) instead of replacing it. This is deliberate, and it is confined to `render` alone - every other member, including getters, methods, subcomponents, and lifecycle hooks, overrides with standard JavaScript replace semantics. `render` is sealed at class bootstrap as the single composition seam; nothing else behaves this way.

The reason: in a reactive component the base's render is *chrome plus subscriptions* - layout, suspense boundary, context - that must run for the subclass to function. Classic override-with-`super.render()` makes every subclass responsible for remembering the call and threading its own output through by hand; one forgotten `super` silently loses the base's boundaries. Composition inverts the default: the base owns its chrome exactly once, the subclass authors only content, and all layers bind to the same reactive `this`. It is the template-method pattern with the wiring made automatic instead of conventional.

A base can opt out and defer to subclass content entirely (identity check on `children` - see [react/component.md](react/component.md)), so leaf primitives remain fully replaceable. The choice sits with the base class, which is the party that knows whether its chrome is load-bearing.

## PascalCase members are JSX's own convention

A PascalCase member on a `Component` becomes a reactive subcomponent. This mirrors the rule JSX itself already enforces - lowercase tags are intrinsic elements, capitalized identifiers are components - so the casing signal is one the reader already applies to every line of JSX. Subcomponents are intended as **extension points** a subclass replaces or wraps; sections that are merely implementation detail belong in freestanding function components using `.get()` (see the counter-rules in [SKILL.md](SKILL.md)).

## Lifecycle hooks are typed members, not name magic

`new()`, `use()`, and `catch()` are declared as optional members on the class types - `protected new?(): void | (() => void)` on `State` in `@expressive/mvc`, `catch?()` on `Component`, `use?()` via the adapter's `State` augmentation. They are typed contract members: editors autocomplete them, their signatures are checked, and TypeScript's `override` keyword flags a misspelled override against the base declaration. The hooks are optional because most models need none of them - `new()` in particular exists for setup-with-cleanup and should not be added ritually.

## Writes are transparent; `is` is bounded

Subscription proxies pass assignments through to the instance, so components read and write the same destructured values - no unwrapping step. The `is` self-reference exists for exactly one pattern: retaining the root object *alongside* sibling destructuring from the same snapshot - a destructured snapshot has no other way back to its proxy root. That makes `is` the deliberate exception to the namespace rule above: after arguing that the instance surface belongs to the model's own fields, the library reserves exactly one property, because one reserved name is the floor for that capability. Using `is` to unwrap every writable object is documented as a misuse ([SKILL.md](SKILL.md), Transparent Writes); the boundary is a rule of the contract, not folklore.

## Concurrent validation is separate from presentation

React adapter does not store model values in `useSyncExternalStore` - external-store updates are blocking, which would forfeit deferred rendering. Subscriber dispatch publishes through ordinary useState, so `pending()` updates keep host priority and may retain prior content while a replacement suspends.

Each subscription exposes a scalar revision to `useSyncExternalStore` for pre-commit validation. A write invalidating a subscriber advances its revision; a yielded render attempt then fails React's consistency check and restarts instead of committing mixed model revisions. A racing write costs that attempt its time-slicing, never consistency. Hosts without `useSyncExternalStore` (React below 18, preact) cannot yield mid-render and skip validation.

The supported floor is React 16.14 (for `react/jsx-runtime`). Validation applies on 18+ and is absent on 16.14-17 - inapplicable, since renders cannot interrupt or interleave a write. Verification is browser-level rather than inferred: the acceptance harness drives a real concurrent root and includes a negative control which tears on every run once the validation call is removed.

## Computed self-reference

A getter reading its own name (`this.total` inside `get total()`) returns the previous cached value rather than recursing - reads under the tracking proxy resolve to the managed property's current cache. This makes "derive from prior value" expressible without a shadow field; it is documented semantics ([state/computed.md](state/computed.md)), not an accident of evaluation order.

## Stability before surface

Pre-1.0 development optimizes for a finishable library, not a growing one. Overlapping convenience APIs are removed rather than accumulated - `hot` fell to `map`/`has`, the standalone `use(instance)` hook to context, placement, and proxy tracking - and the router deliberately keeps a small contract whose priority is stability over features. 1.0 is defined as completion: a bounded surface, documented in these skills, gated by total coverage, and intended to hold still afterward. This is recorded intent, not an inference to draw from commit graphs - after 1.0, low churn should read as a utility that is done, and the pre-1.0 removals are the cost paid for that end state.

## Coverage is measured and gated, not a badge claim

Every package's test script runs `tsc --noEmit && vitest run --coverage` with istanbul thresholds pinning statements, branches, functions, and lines at 100% in its `vitest.config.ts` - not a lines-only claim: every conditional arm is either exercised by a test or deleted as dead code. The `PR` workflow blocks merges on these thresholds. The README coverage badge is not hand-written: the `Coverage` workflow (`.github/workflows/coverage.yml`) re-measures coverage across all packages on every push to `main`, aggregates the lcov output, and publishes the badge value it computed.
