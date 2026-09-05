# examples/AGENTS.md

Guide for the examples playground - a Vite app whose pages ship as crawlable, prerendered example pages on the website.

## Pages are code-first

Each crawlable page exists to serve the source being demonstrated: prerendered output lists every file as copy-pasteable code, which hydration swaps for the live editor. Agents crawling these pages are looking for "how to do a thing" - the source is the content. Never add marketing or pitch prose to these pages.

## Page conventions (`pages/**/App.tsx`)

Declaration order:

1. Imports, then module sentinels (constants).
2. `export default` - a *frame* component: `<div className="container">` holding the `<h1>`, the descriptive `<p>`, the demo as an element (`<Dashboard />`), and any trailing `<small>` note. The export comes first because it is what the reader looks for; the only forced exception is a module sentinel calling `.new()` at eval time, whose class must sit above it.
3. Supporting components and classes.
4. Helper functions last.

Style:

- All descriptive copy lives in the frame. Demo components hold only live content: readouts, `fallback`s, error messages, control labels. A trailing note belongs below the demo element in the export, not inside the demo.
- Copy over comments: anything a comment would explain to the reader belongs in the page's visible copy instead. This is stricter than the repo-wide no-comments rule - an example has a place to put the explanation, so it must use it. Keep a comment only when copy genuinely cannot carry it (cryptic math, why a line is shaped a certain way).
- Arrow functions for function components, consistently. Plain helpers may stay declarations when their position requires hoisting.
- `new Child()` for nested state, never `Child.new()` - bare construction makes the instance state the parent owns (built there, activated into that context, destroyed with it); `.new()` creates a private context-less instance.
- Owned collections use `has()`, never a plain array reassigned by spread - `push` to append, `clear` to reset, `.map((v, i) => ...)` directly in render (it tracks). Spread-and-replace is the React reflex, and an example is where reflexes get copied.
- Keep each example focused. Prefer a render prop over a subclass or subcomponent seam; declare extra render props as `render(props = {} as { ... })`.
- Name demo components for their role, never `Demo`. A `fallback` belongs in a `Fallback()` subcomponent, not JSX built inline inside `catch()`. Render-less components are fine when tree placement is the point.
- Instance-rendering demos use a swappable class member (`active` holding an instance that gets reassigned), not a module-scope singleton placed twice - the lesson is that the field decides what renders, never what exists.
- Reuse the theme tokens from `global.css` (`--s1..6`, `--accent`, `--surface`, ...); register each page in its group's `index.ts` manifest.

## Runtime smoke pass

A page that type-checks and builds can still be broken. Run every new or edited batch through a throwaway harness, then delete both files before committing (this package ships no test script):

```bash
cd examples && bun test --preload ./smoke.dom.ts smoke.test.tsx
```

- `smoke.dom.ts` is a two-line throwaway: import `GlobalRegistrator` from `@happy-dom/global-registrator` and `register()` it, so `document` exists before `@testing-library/*` evaluates. (The old `packages/react/test.dom.ts` preload was deleted in the vitest migration.)
- `import.meta.glob` is Vite-only and undefined under `bun test` - enumerate `pages/<group>/<example>/App.tsx` with `readdirSync` and `await import()` each. CSS imports resolve fine.
- A render-only pass catches crashes, not dead reactivity. Drive interactions with `fireEvent` and assert on `container.textContent`.
- Flush pattern: `await act(async () => fireEvent.click(x)); await settle()` where `settle = ms => act(() => new Promise(r => setTimeout(r, ms)))`. Nesting the settle *inside* the same `act` callback reports the previous render's DOM and invents phantom bugs.

When layout or a real browser crash is in question, happy-dom is not enough - it renders what React computes, not what the page looks like. Use `puppeteer-core` (dev-install, revert the lockfile after) with `executablePath` pointed at installed Chrome, headless, against `bun run dev`. The example itself renders in an iframe: find it via `page.frames()`, screenshot the `iframe` element handle to actually look at it, collect `pageerror` + `console`, and assert `scrollWidth <= clientWidth` to catch content overflowing the example pane.
