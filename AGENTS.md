# AGENTS.md — maintainer instructions

Instructions for agents working in this repository.

## What this repo ships

One OpenCode v2 plugin: `@vasilvestre/opencode-hashline-edit`.

It replaces nothing. It adds a `hashline_edit` tool that edits files by
`LINE#ID` anchors, and rejects an edit when the hash no longer matches the file.
The model reads a file, gets a hash per line, and edits by reference instead of
reproducing content.

## Layout

| Path | Role |
| --- | --- |
| `src/index.ts` | the plugin definition, the only entrypoint |
| `src/hashline-edit-executor.ts` | reads, validates, writes |
| `src/edit-operations.ts` | apply, deduplicate, detect overlap |
| `src/validation.ts` | hash computation and mismatch errors |
| `src/*.test.ts` | vitest suite |
| `dist/` | build output, git-ignored, published |
| `.github/workflows/ci.yml` | typecheck, tests, import check |
| `.github/workflows/release.yml` | build, import check, publish |

## Hard rules

- **Relative imports carry `.js`.** `tsc` with `moduleResolution: nodenext` emits
  the specifier as written, and Node rejects an extensionless relative import in
  ESM. Version 1.1.3 shipped without the extensions and could not load at all.
  Every relative import in `src/` ends in `.js`.
- **Type-only imports say `import type`.** `verbatimModuleSyntax` is on, so a
  value import of a type is a compile error.
- **The build must import before publishing.** `release.yml` runs
  `node -e "import('./dist/index.js')"` and checks the default export is a v2
  definition. Do not remove that step: it is the guard that 1.1.3 lacked.
- **A stale hash is rejected, never repaired.** The mismatch error tells the
  model to re-read. Silently applying an edit to changed content is the failure
  the tool exists to prevent.
- **Three consecutive no-ops throw.** The guard stops a model looping on an edit
  that changes nothing.
- **`dist/` is git-ignored but published.** `files` in `package.json` does not
  list it, so npm packs it from the working tree. The release workflow builds
  before `npm publish`; a manual publish must run `npx tsc` first.

## Before you commit

```bash
npx tsc --noEmit
npm test
npx tsc
node -e "import('./dist/index.js').then(m => console.log(m.default.id))"
```

The last two are what CI runs before publishing. Run them locally when you touch
an import.

## Release

Published to npm. `.github/workflows/release.yml` publishes on every push to
`main` when the version in `package.json` is not on npm yet.

Bumping the version is the release decision:

```bash
npm version patch   # or minor, or major
git push --follow-tags
```

The workflow stops at "Skip when already published" when the version is
unchanged. It never invents a version. `ci.yml` runs the checks only.

The npm trusted publisher points at `vasilvestre/opencode-hashline-edit`,
workflow `release.yml`.

## Commits

Imperative subject, 72 characters or fewer, no trailing period. Say what
changed and why, not how.
