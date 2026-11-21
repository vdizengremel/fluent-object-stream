# Contributing

## Development

```bash
npm ci            # install (dependency install scripts are blocked, see below)
npm test          # vitest
npm run typecheck # tsc: the only step that checks types
npm run lint
npm run build     # dist/ (ESM + CJS + .d.ts)
```

Requires Node 22 or later. CI runs lint, tests on Node 22, 24 and 26, build, and [zizmor](https://docs.zizmor.sh/) on the
GitHub Actions workflows.

## Pull requests

- PRs are **squash-merged**, and the **PR title becomes the commit message** on `main`.
- The version number is computed from those messages by semantic-release, so the PR title must follow
  [Conventional Commits](https://www.conventionalcommits.org/), with a lowercase subject. The `lint-pr-title` check
  enforces it.

| PR title                                         | Release               |
| ------------------------------------------------ | --------------------- |
| `fix: ...`                                       | patch (1.0.0 → 1.0.1) |
| `feat: ...`                                      | minor (1.0.0 → 1.1.0) |
| `feat!: ...` or `BREAKING CHANGE:` in the body   | major (1.0.0 → 2.0.0) |
| `chore:`, `ci:`, `docs:`, `test:`, `refactor:` … | no release            |

## Dependency install scripts

Install scripts (`postinstall`, …) of dependencies do not run: CI uses `npm ci --ignore-scripts`, and npm ≥ 11.16 reads
the `allowScripts` allowlist in `package.json`. When a new dependency ships an install script, npm lists it at the end
of the install. Review it with `npm install-scripts ls`, then `npm install-scripts deny <pkg>` (preferred, if the
package works without it) or `npm install-scripts approve <pkg>`.

## Releasing (maintainers)

Releases are manual and need two human approvals. Nothing is published on merge.

1. **Actions → CI → Run workflow** on `main`. On the run triggered by a merge (push), the `release` job is always
   shown as _skipped_: that is expected, a release only runs from **Run workflow**.
2. Lint, tests and build run, then the `release` job waits: **Review deployments → Approve** (`npm-publish`
   environment).
3. semantic-release computes the version, **stages** it on npm (`npm stage publish`, through trusted publishing), then
   pushes the `vX.Y.Z` tag and creates the GitHub Release with the release notes.
4. **Approve the staged version on npm with 2FA**: on npmjs.com, or with `npm stage list fluent-object-stream` then
   `npm stage approve <id>`. The version becomes public only now. Do it right after the run: until then, the GitHub
   Release announces a version that cannot be installed.

If only `chore:`/`ci:`/`docs:` commits were merged since the last tag, the job succeeds without releasing anything.

Release notes live in [GitHub Releases](https://github.com/vdizengremel/fluent-object-stream/releases). `CHANGELOG.md`
is frozen, and the `version` field of `package.json` on `main` is not updated: the git tag and npm are the source of
truth.

### When something goes wrong

- **Staged version rejected** (`npm stage reject <id>`): the tag and the GitHub Release already exist and, with
  immutable releases, cannot be deleted. That version number is burned: mark the GitHub Release notes as "not published
  on npm", fix the problem with a new `fix:` PR, and release again. semantic-release starts from the last tag, so the
  next release automatically takes the next number.
- **`npm stage publish` fails with 401/403/404**: the OIDC token does not match the trusted publisher configuration on
  npm (repository, workflow file name, environment name, allowed actions). Check it with
  `npm trust list fluent-object-stream`. The tag was already pushed, but no GitHub Release was created (the GitHub
  step runs after the npm one), so the tag is not protected yet: delete it (`git push origin --delete vX.Y.Z`) before
  retrying.
- **Trusted publisher expired**: npm expires a new trusted publisher configuration that is not validated by a publish
  within a few days. Delete it and create it again right before releasing.
- **Publish by hand** (emergency only): from a clean checkout of the tag, `npm ci --ignore-scripts && npm run build`,
  then `npm publish` (asks for 2FA).

## External configuration

This setup lives outside the repository. Keep it in sync with the workflow.

### npm (package settings)

- **Trusted Publisher**: GitHub Actions, repository `vdizengremel/fluent-object-stream`, workflow file `ci.yml`,
  environment `npm-publish`. Allowed actions: **stage publish only** (direct publish and dist-tag unchecked).
- **Publishing access**: "Require two-factor authentication and disallow bypass 2FA tokens".
- No npm access token is used anywhere.

### GitHub (repository settings)

- **Environments → `npm-publish`**: required reviewer (the maintainer, self-review allowed), deployment branches limited
  to `main`.
- **General → Pull Requests**: squash merging only, default commit message "Pull request title", "Automatically delete
  head branches" enabled.
- **Rules → ruleset on `main`**: pull request required, required checks `ci-ok` and `lint-pr-title`, no force push.
- If a rule protects `v*` tags, GitHub Actions must be allowed to create them (semantic-release pushes the tag with the
  workflow's `GITHUB_TOKEN`).
- **Secrets**: none. The release job only uses the ephemeral `GITHUB_TOKEN` and OIDC.
- **Security**: private vulnerability reporting, secret scanning with push protection and Dependabot alerts enabled.
- **Releases**: immutable releases enabled (a published release, its tag and its assets cannot be changed or deleted).
