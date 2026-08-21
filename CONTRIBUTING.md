# Contributing to Intelis-Agent

Thank you for helping improve Intelis-Agent. Contributions should make the research workflow more reliable, more observable, or easier to operate without weakening evidence handling or data isolation.

## Before you start

Search existing issues and pull requests before opening a new issue. Use the bug-report form for reproducible defects and the feature-request form for proposals. For security vulnerabilities, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Local setup

The project uses Node.js 22 and pnpm. From a fresh clone:

```bash
pnpm install
cp .env.example .env
```

Provide a MySQL-compatible `DATABASE_URL` and only the integration credentials needed for the behavior you are testing. Never use production credentials in local development or tests.

## Development workflow

Create a focused branch from `main`. Branch names should make the intent clear, for example `fix/scheduler-fallback`, `feature/webhook-delivery`, or `docs/contributing-guide`.

Use the existing scripts rather than adding ad hoc commands to documentation:

```bash
pnpm dev
pnpm check
pnpm test
pnpm build
```

Run `pnpm format` when you have changed TypeScript, TSX, CSS, JSON, or Markdown files. If a change affects the database schema, update the Drizzle migration state using `pnpm db:push` in a disposable development database and explain the schema impact in the pull request.

## Code expectations

Keep client-only behavior under `client/`, server-only behavior under `server/`, and shared contracts under `shared/`. Validate external and user-controlled input at the boundary. Preserve task ownership checks for protected mutations and do not move provider credentials into client code. When changing the research pipeline, update or add tests for stage state, failure behavior, and delivery behavior as applicable.

Research-source content is untrusted input. Do not add prompts or parsers that follow instructions found inside fetched pages. Preserve source URLs and provenance when introducing new finding or report behavior.

## Pull requests

Open a pull request against `main` with a concise title and a description that explains the problem, the approach, and any user-visible behavior change. Include:

- The issue or motivation, when one exists.
- The commands run locally and their results.
- Database migration or environment-variable changes.
- Screenshots or a short recording for material UI changes.
- Compatibility, rollout, and security considerations.
- Any known limitation or follow-up work that is intentionally out of scope.

Keep pull requests small enough to review. Do not combine unrelated refactors with a feature or bug fix. A maintainer may request changes before merge; approvals are not guaranteed by the repository’s current governance settings.

## Commits

Use short, imperative commit subjects. Conventional Commit prefixes such as `fix:`, `feat:`, `docs:`, `test:`, and `refactor:` are encouraged because they make the history easier to scan, but they are not currently enforced.

## Review checklist

Before requesting review, confirm that the change does not commit `.env` files, tokens, private source material, database dumps, build output, or generated credentials. Confirm that `pnpm check`, `pnpm test`, and `pnpm build` pass, and that README or configuration documentation is updated when behavior changes.
