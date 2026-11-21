# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`fluent-object-stream` is a small, zero-runtime-dependency TypeScript library published to npm. It wraps Node.js object-mode streams in a strongly typed, chainable API (`map`, `filter`, `groupByChunk`, `forEach`, `toArray`, …). Errors and stream teardown are handled by Node's `stream/promises` `pipeline`.

## Commands

```bash
npm test                          # vitest run, runs src/**/*.test.ts
npm run test:watch                # vitest in watch mode
npx vitest run -t 'should stream mapped data'   # run one test by name
npx vitest run -t '#groupByKey'                 # run one describe block (blocks are named '#methodName')
npm test -- --coverage            # what CI runs (v8 coverage, lcov for Coveralls)
npm run lint                      # eslint on src/
npm run lint:fix
npm run prettier                  # format src/**/*.ts
npm run build                     # tsup -> dist/ (ESM + CJS + .d.ts), uses tsconfig.build.json (excludes tests)
```

CI (`.github/workflows/ci.yml`) runs lint, tests on Node 22, 24 and 26, and build in parallel; the `ci-ok` gate job aggregates them and is the only check to mark as required in branch protection. Actions are pinned by SHA and kept up to date by Dependabot (`.github/dependabot.yml`). Releases are done by `semantic-release` only on a manual `workflow_dispatch` on `main` (release job runs on Node 26, required by semantic-release 26). Version and CHANGELOG are derived from commit messages, so use Conventional Commits (`feat:`, `fix:`, `chore:`, …). PRs are squash-merged with their title as commit message; `.github/workflows/pr-title.yml` checks that the PR title follows Conventional Commits (lowercase subject).

Style (Prettier): no semicolons, single quotes, 2-space indent, 120 columns, `es5` trailing commas.

## Architecture

All code lives in `src/`. `src/index.ts` is the public barrel. Internal modules also import from `'.'` (index), so keep that circular import pattern consistent when adding files and export any new public type from `index.ts`.

- **`ObjectStream<T>`** (`object-stream.ts`): an immutable builder. It holds the source `Readable`, an array of pending `Transform`s and `ObjectStreamOptions`. Each intermediate operation returns a **new** `ObjectStream` with one more transform appended. Nothing runs until a terminal operation is called.
- **Intermediate operations** all go through `transformWith(objectTransform, options)`, which builds a `Transform` via `createTransform` and then calls `applyTransform`. `applyTransform` also accepts a raw user-supplied `Transform`. When you add a new operator, implement it with `transformWith` the same way the existing ones are.
- **Terminal operations**: `writeTo(writable)` is the core one and runs `pipeline([source, ...transforms, writable])`. `forEach` wraps the callback in an object-mode `Writable` and calls `writeTo`. `toArray` is built on `forEach`. A terminal operation consumes the underlying readable, so an `ObjectStream` chain can only be executed once.
- **`ObjectTransform<T, R>`** (`object-transform.ts`): `{ transformElement(value, pushData), onEnd?(pushData) }`. `transformElement` may be async. `onEnd` maps to the Transform's `flush`.
- **`createTransform`** (`transform-factory.ts`): it is also exported publicly so users can hand a Transform to external libraries. It creates an object-mode `Transform`. Thrown or rejected errors are passed to the callback. Non-`Error` throwables are wrapped in `StreamError` (the original value is in `.cause`). `forEach` uses the same wrapping.
- **Options**: `ObjectStreamOptions` currently only has `highWaterMark`. Options merge forward (`{ ...this.options, ...options }`), so an override applies to the current operation and every later one. `groupByKey` and `groupByChunk` force `highWaterMark: 1` because each element they emit holds many items.
- Stateful operators (`groupByKey`, `groupByChunk`) keep their state in closures created when the operator is called. `groupByKey` only groups *consecutive* elements with the same key, so the input must already be sorted by that key.

Tests are in `src/object-stream.test.ts`, with one `describe('#method')` block per method. They build streams with `Readable.from(array)`. Vitest globals are not enabled: import `describe`/`it`/`expect`/… from `'vitest'` explicitly.
