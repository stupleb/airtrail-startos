<p align="center">
  <img src="icon.svg" alt="AirTrail Logo" width="21%">
</p>

# AirTrail on StartOS

> Everything not listed in this document should behave the same as upstream
> AirTrail. If a feature, setting, or behavior is not mentioned here, the
> upstream documentation is accurate and fully applicable — see the
> Documentation section of `instructions.md` for links.

[AirTrail](https://github.com/johanohly/AirTrail) is a personal flight tracker: every flight on a world map, with statistics, visited countries, imports from other trackers, accounts for several people, public share links, a REST API and an MCP server. This package runs it with its PostgreSQL database and creates the owner account itself, so AirTrail's Welcome screen, where the first visitor becomes the owner, never opens.

- **Upstream repo:** <https://github.com/johanohly/AirTrail>
- **Wrapper repo:** <https://github.com/stupleb/airtrail-startos>

---

## Table of Contents

- [Image and Container Runtime](#image-and-container-runtime)
- [Volume and Data Layout](#volume-and-data-layout)
- [File Models](#file-models)
- [Dependencies](#dependencies)
- [Network Access and Interfaces](#network-access-and-interfaces)
- [Installation and First-Run Flow](#installation-and-first-run-flow)
- [Actions](#actions)
- [Tasks](#tasks)
- [Health Checks](#health-checks)
- [Backups and Restore](#backups-and-restore)
- [Limitations and Differences](#limitations-and-differences)
- [Quick Reference for AI Consumers](#quick-reference-for-ai-consumers)

---

## Image and Container Runtime

Two images run as two processes plus a setup step. `johly/airtrail` is built through the root `Dockerfile`, which installs Debian's CA store and sets `NODE_OPTIONS=--use-openssl-ca`, so Node verifies outbound TLS against that store instead of its compiled-in roots, which still trust the compromised eMudhra emSign ECC Root CA - G3. The layer is temporary and comes out once upstream ships an image on a Node release without G3. `postgres` runs unmodified.

| Image      | Source                                      | Architectures   |
| ---------- | ------------------------------------------- | --------------- |
| `airtrail` | `johly/airtrail` with the root `Dockerfile` | x86_64, aarch64 |
| `postgres` | `postgres` (Alpine)                         | x86_64, aarch64 |

| Subcontainer | Runs                               | Purpose                                                           |
| ------------ | ---------------------------------- | ----------------------------------------------------------------- |
| `postgres`   | daemon `postgres`                  | PostgreSQL, listening on `127.0.0.1` only                         |
| `airtrail`   | oneshot `setup`, daemon `airtrail` | The app, and the step that prepares its database before it starts |

Start order: `postgres` → `setup` → `owner-applied` (clears the pending-password flag once `setup` has applied it) → `airtrail` and `reconcile-dependent-keys`. The last drops the keys and requests of services that are no longer installed, and forgets keys a user deleted in AirTrail.

- **`setup`** runs upstream's migration runner (`node docker/migrate.js`), then `assets/accounts.mjs`, which creates the owner on an empty database and applies a password Set Owner Password could not apply itself. The script runs on the image's own Node.js and its `pg` and `@node-rs/argon2` modules, and hashes passwords with AirTrail's own Argon2 settings.
- **`airtrail`** runs upstream's entrypoint unchanged: it gives `/app/uploads` to uid 1000, drops to that user, runs the migrations again (none are pending by then), and starts the server on port 3000.

The actions run `accounts.mjs` in a temporary `accounts` subcontainer of the AirTrail image, and read usernames with `psql` in a temporary `query-database` subcontainer of the PostgreSQL image.

## Volume and Data Layout

Three volumes. Everything AirTrail stores — users, flights, tracks, roles, shares, API keys, settings, and the airport, airline and aircraft lists — is in PostgreSQL.

| Volume    | Mount point                                   | Contents                                                                             |
| --------- | --------------------------------------------- | ------------------------------------------------------------------------------------ |
| `startos` | — (host side)                                 | `store.json`                                                                         |
| `main`    | its `uploads/` at `/app/uploads` (`airtrail`) | Airline icons: the set AirTrail downloads on its first start, and any uploaded since |
| `db`      | `/var/lib/postgresql` (`postgres`)            | The PostgreSQL cluster, data in its `data/`                                          |

## File Models

One model, `store.json` on the `startos` volume. AirTrail itself has no configuration file: the package configures it through environment variables, set on every start.

| Key                    | Set by                                                        | Notes                                                                                                |
| ---------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `postgresPassword`     | Install                                                       | Internal; part of `DB_URL`                                                                           |
| `ownerUsername`        | Set Owner Password                                            | The owner's username as the package last set it                                                      |
| `ownerPassword`        | Set Owner Password                                            | The last password the package issued                                                                 |
| `ownerPasswordPending` | Set Owner Password, `owner-applied`                           | `true` while an issued password has not reached the database                                         |
| `dependentKeys`        | Request / Approve / Revoke Access, `reconcile-dependent-keys` | Each service's requested key: hash, scopes, label, and once approved the AirTrail account and key id |

Variables set on every start: `DB_URL`, `UPLOAD_LOCATION=/app/uploads`, and `ADDRESS_HEADER=X-Forwarded-For`. `ORIGIN` is deliberately left unset; see [Network Access and Interfaces](#network-access-and-interfaces).

**What the package leaves alone:** none of AirTrail's settings variables (`OAUTH_*`, `INTEGRATIONS_*`, `MAP_*`) are set, so every field on AirTrail's **Settings** pages stays editable and is stored in its database. Each of those variables would lock its field.

**Changing the owner inside AirTrail is safe.** The package never re-applies its password on a start; only Set Owner Password changes it. Renaming the owner in AirTrail is fine too: the action finds the owner account, not a username.

## Dependencies

None.

## Network Access and Interfaces

One interface. The web app, the REST API (`/api/v1`), the MCP endpoint (`/api/mcp`) and public share links (`/share/<slug>`) share it.

| Interface | Id   | Type | Port | Protocol |
| --------- | ---- | ---- | ---- | -------- |
| Web UI    | `ui` | ui   | 3000 | HTTP     |

**Every HTTPS address works without configuration.** Upstream requires `ORIGIN` to be the single URL users open, and rejects form posts — sign-in among them — whose `Origin` differs. With `ORIGIN` unset, AirTrail takes each request's origin from `X-Forwarded-Proto` (`https` when absent) and the `Host` header, so the check compares against whatever address the browser used. StartOS adds `X-Forwarded-Proto: https` and `X-Forwarded-For` to every HTTPS request, and strips any a client sends.

- **Plain-HTTP addresses cannot sign in.** The origin AirTrail computes is always `https://`, so a form posted from an `http://` page — an `http` onion address, for one — is refused with `403 Cross-site POST form submissions are forbidden`. Pages load; signing in and saving forms fail.
- **Login is rate limited per client:** 10 attempts a minute per address, 5 per address and username, keyed on `X-Forwarded-For`. Requests without that header — from another service on the server, for instance — are not limited.
- **OIDC sign-in** sends the identity provider the address the user signed in from, plus `/login`, as its redirect URI; register each address people use.

AirTrail reaches out on its own: the first start downloads the airport list from OurAirports (GitHub Pages) and the airline and aircraft lists and airline icons from AirTrail's GitHub repository. The browser loads map tiles from OpenFreeMap unless another provider is chosen in AirTrail's settings, and checks GitHub for AirTrail releases. Flight-number lookups go to adsbdb, or to AeroDataBox once a key is set in AirTrail's settings.

## Installation and First-Run Flow

Nothing about the owner account is left to whoever opens the address first.

1. Install generates the database password.
2. The critical **Set Owner Password** task blocks the first start. It asks for the owner's username, generates the password, and shows both.
3. The first start runs every migration, then `setup` creates the owner with that username before AirTrail itself starts. AirTrail then downloads its airport, airline and aircraft data and airline icons, and only then opens its port.

The first start takes under a minute on a small x86 server with a good connection; later starts take seconds. Without internet access the first start cannot finish: AirTrail exits when the airport download fails, and StartOS keeps starting it again, at most 30 seconds apart.

## Actions

Two actions for people, both about passwords, and three hidden ones for other services. AirTrail has no password reset by email, and upstream's own reset is a command-line tool run inside the container.

### Set Owner Password

- **When:** first run (its task), when the owner's password is lost, or to rename the owner.
- **Input:** the username. Later runs pre-fill the owner's current username, read from AirTrail's database while it is running.
- **What it changes:** generates a new password and sets it, with the username, on AirTrail's owner account — there is exactly one. A different username renames the owner; one that another account already has, compared without case, is refused.
- **While AirTrail is running** the password is applied at once and the old one stops working; sessions already signed in stay signed in. **While it is stopped** the password is stored and applied by `setup` on the next start (`ownerPasswordPending`). If another account has taken the chosen username by then, the owner keeps its old username and the log says so.
- **Cost:** a few seconds; nothing restarts.
- **Repeat safety:** each run replaces the password.
- **Outputs:** the username and the password.

### Reset User Password

- **When:** someone other than the owner cannot sign in. Administrators in AirTrail can edit other people's accounts but not their passwords.
- **Input:** the account, chosen from every account except the owner's. The list is read from AirTrail's database, so the action is offered only while AirTrail runs.
- **What it changes:** generates a new password and sets it on that account. The old password stops working; sessions already signed in stay signed in. For an account that signs in through OIDC only, it adds a password it did not have.
- **Cost:** a few seconds; nothing restarts.
- **Repeat safety:** each run replaces that account's password.
- **Outputs:** the account's username and the new password, to hand to that person; they can change it under **Settings → Security** in AirTrail.

`accounts.mjs` takes its job from `STARTOS_TASK`: `set-owner` (with `STARTOS_USERNAME`, `STARTOS_PASSWORD`, and `STARTOS_APPLY` — whether to change an owner that exists — and `STARTOS_STRICT` — whether a taken username fails rather than being skipped) or `reset-user` (with `STARTOS_USER_ID` and `STARTOS_PASSWORD`). It prints `STARTOS_USERNAME=` with the account's resulting username, and on failure one of `STARTOS_DB_UNREACHABLE`, `STARTOS_USERNAME_TAKEN` or `STARTOS_USER_MISSING`.

### Access for other services (hidden)

`request-access`, `approve-access` and `revoke-access` are hidden and not for a user to run directly. Another installed service that declares AirTrail as a dependency uses them to read one person's flights without anyone copying an API key, the same contract as Immich's.

- **`request-access`** (dependent services only, any state): input `keyHash` (SHA-256 of an ASCII secret the service generated, 64 lowercase hex), `permissions` (a non-empty subset of `profile.read`, `flight.read.own`, `flight.export.own`, `stats.read`, `tracks.read`, `visited_countries.read`, `reference_data.read` — reading only) and `label` (shown to the user, e.g. the requester's account email; send `null` when there is none). It records the request and raises an Approve Access task. The same hash with the same scopes is a no-op; the same hash with other scopes, or another service's hash, fails.
- **`approve-access`** (users only, opened from that task): the user picks the AirTrail account, or denies. Approving inserts the key into AirTrail's `api_key` table as `StartOS: <service>` (stored the way AirTrail stores its own, `base64(sha256(key))`), visible under that account's **Settings → Security**, and deletes any other key the same service holds in that account. Denying deletes the request.
- **`revoke-access`** (dependent services only, while running): input `keyHash`, `null` for all of the caller's keys and requests.

The requesting service learns the outcome by using its key: `401` until approved (or after a deny or revoke), `200` once approved, `403` for a scope it was not granted. `GET /api/v1/me` with `profile.read` names the chosen account. AirTrail caps every key at its account's role. A service reaches AirTrail on its bridge address over plain HTTP; its requests are GETs with a bearer key, so the HTTPS-only sign-in limit does not apply to them.

## Tasks

Two kinds of task.

| Task               | Severity    | Raised when                                                                            | Cleared when                                                       |
| ------------------ | ----------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Set Owner Password | `critical`  | No owner password is stored — on install, and on any init that finds none              | Set Owner Password runs                                            |
| Approve Access     | `important` | A service ran `request-access`; one task per request, naming the service and its label | The user approves or denies it, or the service revokes the request |

A service that will not start and offers no Start button is waiting on this task.

## Health Checks

One check is shown. The database check is hidden.

| Check         | Probes                                                                           | Grace |
| ------------- | -------------------------------------------------------------------------------- | ----- |
| Web Interface | Port 3000 is listening — AirTrail opens it only after loading its reference data | 5 min |

- **Not ready past its grace period on a first start:** the airport download is failing — the log shows `Failed to fetch airport source CSV` or a network error, and the server restarting. It succeeds once the server can reach GitHub.
- **Failing after it was ready:** the server stopped; the log says why. A failing `setup` (a migration error, or the database not answering) stops the chain before AirTrail starts, and shows in the log above AirTrail's own lines.

Four log lines look like faults and are not:

- `WARNING: there is already a transaction in progress` and `WARNING: there is no transaction in progress` — the first start only, from an upstream migration that opens its own transaction.
- `initdb: warning: enabling "trust" authentication for local connections` and `WARNING: no usable system locales were found` — the first start only, from PostgreSQL's image creating the cluster. Connections from AirTrail use a password.

## Backups and Restore

The database is dumped, not copied: `sdk.Backups.withPgDump` runs `pg_dump` of the `airtrail` database, and restore creates a fresh cluster and replays the dump. The `startos` and `main` volumes are copied as they are.

- **Included:** every user, flight, track, share, API key and setting (database), the airline icons (`main`), and `store.json` with the database password and the owner's credentials.
- **Excluded:** nothing.
- **After a restore:** nothing to redo. The owner's password is whatever it was when the backup was taken.

## Limitations and Differences

What the package leaves out or does differently from upstream's Docker setup.

1. **The Welcome screen never appears.** The owner is created by the package with the username given to Set Owner Password.
2. **Plain-HTTP addresses cannot sign in**, so use an HTTPS address — the `https` onion address rather than the `http` one.
3. **The session cookie is not marked `Secure`.** AirTrail sets that flag only when `ORIGIN` starts with `https://`, and the package leaves `ORIGIN` unset so that every address works.
4. **AirTrail's update notice** reports upstream releases to the owner and administrators. Updates arrive through StartOS once the package ships them.
5. **No demo mode, outbound proxy or settings locked by environment variables** — none is configured by the package.
6. **No armv7 or riscv64 build.**

---

## Quick Reference for AI Consumers

The package's operable surface in one block; each key mirrors a section above.

```yaml
package_id: airtrail
image: johly/airtrail # plus postgres (Alpine)
architectures:
  - x86_64
  - aarch64
subcontainers:
  - postgres
  - airtrail # setup oneshot and the airtrail daemon
volumes:
  startos: store.json (host side)
  main: its uploads/ at /app/uploads
  db: /var/lib/postgresql
file_models:
  - store.json
startos_managed_env_vars:
  - DB_URL
  - UPLOAD_LOCATION
  - ADDRESS_HEADER
dependencies: none
interfaces:
  ui: { type: ui, port: 3000 }
actions:
  - set-owner-password
  - reset-user-password # only while running
  - request-access # hidden; dependent services only
  - approve-access # hidden; opened from its task
  - revoke-access # hidden; dependent services only
tasks:
  - { action: set-owner-password, severity: critical }
  - { action: approve-access, severity: important } # one per access request
health_checks:
  - airtrail
```
