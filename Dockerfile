# The API. Multi-stage so the runtime image carries a bundle and 22 production
# dependencies rather than the whole workspace.
#
# Debian slim, not Alpine: `bcrypt` is a native module and musl builds of it are
# a recurring source of postinstall failures on container hosts.
#
# Node 24, not 22, and the version matters more than it looks: node:22 ships
# npm 10, which reads an npm 11 lockfile differently and fails `npm ci` with
# "Missing: chokidar… from lock file" for transitive optional dependencies.
# Whoever changes this tag should check `npm -v` inside the image still matches
# the major that wrote package-lock.json.
FROM node:24-slim AS builder

WORKDIR /app

# The whole workspace, because npm workspaces have to be on disk for `npm ci`
# to link them.
COPY . .

RUN npm ci

# Nx refuses to build when the TypeScript project references drift from the
# graph, and in a non-TTY container it cannot offer to fix them — so do it here.
RUN npx nx sync

# `prune` runs the build and then writes apps/backend/dist/package.json and
# package-lock.json containing only what the bundle actually requires. That
# pruned pair is what the runtime stage installs from.
#
# Note the four packages the socket and the scheduler need are declared in
# apps/backend/package.json, NOT only at the workspace root: this target reads
# the app's manifest, and a dependency listed only at the root is silently
# dropped here and missing at boot.
RUN npx nx run @org/backend:prune


FROM node:24-slim AS production

WORKDIR /app

ENV NODE_ENV=production

# Install from the pruned manifest, not the workspace root's.
COPY --from=builder /app/apps/backend/dist/package.json ./package.json
COPY --from=builder /app/apps/backend/dist/package-lock.json ./package-lock.json
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/apps/backend/dist/main.js ./main.js

# No .env is copied. Configuration arrives as environment variables, so the
# image holds no secrets and the same one can be promoted between environments.

# Non-root. Nothing here writes to disk — uploads and the database live
# elsewhere — so the app owns nothing it does not need to.
RUN groupadd -g 1001 bytegym && useradd -m -u 1001 -g bytegym bytegym \
  && chown -R bytegym:bytegym /app
USER bytegym

EXPOSE 3000

# /api/health is @Public(), so this needs no token.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "main.js"]
