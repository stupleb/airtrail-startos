# Updating the upstream version

"Upstream" is the AirTrail Docker image `johly/airtrail`, pinned by tag in `startos/manifest/index.ts` (`images.airtrail.source.dockerBuild.buildArgs.IMAGE`), which the root `Dockerfile` builds on. Tags carry a `v` prefix and match the GitHub release tags; `latest` and the major tag (`v3`) move with every release. PostgreSQL is pinned beside it (`images.postgres`).

## Determining the upstream version

```bash
gh release view -R johanohly/AirTrail --json tagName -q .tagName
curl -s "https://hub.docker.com/v2/repositories/johly/airtrail/tags/<tag>" | jq -r '.images[] | .architecture'
```

Confirm the tag exists for `amd64` and `arm64` before pinning it, and read every release's notes between the old and new versions for breaking changes.

## Applying the bump

1. Set `images.airtrail.source.dockerBuild.buildArgs.IMAGE` to `johly/airtrail:<tag>`. If the new image runs Node 22.23.4 or later (`docker run --rm --entrypoint node johly/airtrail:<tag> --version`), drop the root `Dockerfile` and go back to `dockerTag`: it only exists to distrust eMudhra's G3 root.
2. Set `startos/versions/current.ts` to `<version>:0` — the tag without its `v` — and write release notes per the workspace's release-note rules. When the version already there has an `up` that does work, first move it into its own file under `startos/versions/` and list it in `other` in `index.ts`.
3. Diff what the package depends on between the two tags:

   ```bash
   git -C <AirTrail clone> diff <old>..<new> -- docker/ .env.example prisma/ \
     src/lib/server/utils/auth.ts src/lib/server/utils/hash.ts src/lib/server/auth.ts \
     src/lib/server/security/csrf.ts src/hooks.server.ts src/lib/zod/user.ts
   ```

   - `docker/entrypoint.sh` runs as-is, and `setup` runs `docker/migrate.js` itself before `assets/accounts.mjs`. A new variable `.env.example` marks as required goes into `appEnv` in `startos/utils.ts`.
   - `assets/accounts.mjs` writes `user` rows directly. It depends on the `user` table and its owner/role check constraint (`prisma/`), on `createUser` in `src/lib/server/utils/auth.ts`, and on the Argon2 options in `src/lib/server/utils/hash.ts`. `usernameRegex` in `startos/utils.ts` copies `usernameSchema` from `src/lib/zod/user.ts`.
   - `ORIGIN` stays unset only while the cross-site check (`src/lib/server/security/csrf.ts`, called from `src/hooks.server.ts`) compares against the request's own origin, and `env.ORIGIN` is read only for the session cookie's `secure` flag (`grep -rn "env.ORIGIN" src`).

4. Build, install over an existing instance, and check the Web Interface health check, a sign-in, adding a flight, and both actions while AirTrail runs.

## Supporting image

- **`postgres`** pins `postgres:<16.x>-alpine`. Move the 16.x minor freely. Never change the major version without a migration that dumps and restores the database: a new major cannot read the old cluster.
