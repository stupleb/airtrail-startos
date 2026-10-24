ARG IMAGE
FROM ${IMAGE}
# The base image ships no system CA store.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && ! grep -q MIICTjCCAdOgAwIBAgIKPPYHqWhwDtqLhDAKBggqhkjOPQQDAzBr /etc/ssl/certs/ca-certificates.crt
# Upstream's Node predates the October 2026 security release.
COPY --from=node:22.23.4-bookworm-slim /usr/local/bin/node /usr/local/bin/node
ENV NODE_VERSION=22.23.4
RUN [ "$(node --version)" = "v$NODE_VERSION" ]
# Node otherwise trusts its compiled-in roots instead of the system store.
ENV NODE_OPTIONS=--use-openssl-ca
