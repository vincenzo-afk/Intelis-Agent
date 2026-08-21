# Security Policy

## Supported versions

Intelis-Agent is an actively developed public repository, but it does not currently publish a formal release-support matrix. The `main` branch is the only branch treated as current. Security fixes should target the latest source on `main` unless a maintainer states otherwise.

## Reporting a vulnerability

Please do not disclose exploitable details in a public issue or pull request.

Use the repository’s [private security advisory form](https://github.com/vincenzo-afk/Intelis-Agent/security/advisories/new) when it is available. If GitHub does not make that form available, contact the maintainer through the [vincenzo-afk GitHub profile](https://github.com/vincenzo-afk) and request a private reporting channel. Include the affected commit or version, an impact summary, reproduction steps, and any suggested mitigation that can be shared safely.

The maintainer will assess the report, coordinate a fix when appropriate, and decide when public disclosure is safe. This project does not promise a fixed response or remediation time.

## Security practices in the codebase

The application currently includes several relevant safeguards:

- Session tokens are signed and verified as HS256 JWTs using `JWT_SECRET`.
- Protected tRPC procedures authenticate the caller and re-check task ownership before mutations.
- The scheduled research endpoint requires a cron identity and task UID, returning `403` to non-cron callers.
- Input contracts are validated with Zod, including task fields, source types, cron expressions, emails, and collection/entity values.
- Provider secrets are read on the server and are not intended for client bundles.
- Source material is treated as untrusted text by the LLM prompts.

These controls are not a substitute for deployment hardening. Keep secrets in the hosting platform’s secret manager, restrict database access, review third-party integrations, and monitor delivery and audit events.

## Safe handling of reports

When sharing logs or test fixtures, remove session cookies, bearer tokens, API keys, database URLs, private source material, recipient email addresses, and personally identifiable information. Do not upload production database dumps or `.env` files to issues or pull requests.
