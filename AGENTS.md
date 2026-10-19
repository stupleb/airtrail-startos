# AGENTS.md

This is a StartOS service-package repository — it builds a `.s9pk` for StartOS.

Develop it inside a StartOS packaging workspace created by `start-cli s9pk init-workspace`,
which provides the packaging guide and agent context one level up. If you're reading this in a
bare clone with no workspace, the full guide is at <https://docs.start9.com/packaging>.

- **Never set `ORIGIN`,** although upstream's docs call it required: it pins every request to one address, and AirTrail then refuses sign-in on every other address StartOS gives the interface.
- **Nothing may start AirTrail's server before `setup` has created the owner.** Its Welcome screen makes the first visitor the owner, which is why `airtrail` requires `owner-applied`.
- **Don't set AirTrail's settings variables** (`OAUTH_*`, `INTEGRATIONS_*`, `MAP_*`) from `main.ts`: each one locks its field on AirTrail's Settings pages.
- **Keep the assets mounted inside `/app` (`ASSETS_PATH`).** `assets/accounts.mjs` imports `pg` and `@node-rs/argon2`, which Node resolves from the image's `/app/node_modules` only from there.
- **Keep `dependentKeyScopes` read-only.** The approval task tells the user a service is asking to *read* flights; a write scope added there would be granted under that wording.
