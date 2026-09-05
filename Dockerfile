# LangX v2 API — built from the workspace root, not from apps/api.
#
# The bundle is produced from workspace sources and pnpm needs the whole
# workspace to honour the lockfile, so the build context is the entire repo.
# .dockerignore keeps apps/mobile out of it except for its manifest.

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# Pinned explicitly rather than resolved through corepack: corepack is
# deprecated in Node 24 and removed in 25, and a package manager that drifts a
# major version on a base-image rebuild surfaces as an unrelated lockfile error
# at deploy time.
RUN npm install --global pnpm@10.17.1
WORKDIR /app

FROM base AS build
# Manifests first, so editing a source file reuses the cached install layer.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
# Never built here, but --frozen-lockfile compares the lockfile against every
# workspace project and fails on a missing one.
COPY apps/mobile/package.json apps/mobile/
RUN pnpm install --frozen-lockfile --filter @langx/api...

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @langx/api run build

# `deploy` is what turns a workspace package into a self-contained directory:
# /out gets the built dist plus a node_modules holding only the API's
# production dependencies.
#
# --legacy because pnpm 10 otherwise refuses to deploy a workspace that does
# not set inject-workspace-packages. node-linker=hoisted because the default
# symlink layout keeps a .pnpm store that carries the *whole* workspace —
# Expo, React Native and the Hermes compiler included, none of which the API
# has any use for, and which cost about 700MB of image.
RUN pnpm --filter @langx/api deploy --prod --legacy --config.node-linker=hoisted /out

FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# The one native binary this image needs, and only for one thing: a voice note
# recorded in a browser is WebM/Opus, which no iPhone can decode, so the API
# converts it to AAC before storing it (`modules/media/transcodeAudio`). It is
# a couple of hundred megabytes on an otherwise lean image, which is the reason
# it is installed here in the runtime stage rather than in the build one, where
# it would be baked into a layer nothing runs. Missing ffmpeg is not fatal —
# those notes are then stored as recorded.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

# The bundle is ESM with a .js extension, so package.json and its
# `"type": "module"` have to travel with it or Node parses it as CommonJS and
# dies on the first import. packages/shared is deliberately absent — the build
# inlines it rather than leaving it an external import, because it ships as
# TypeScript source that Node cannot resolve.
COPY --from=build --chown=node:node /out ./

# The share-card fonts and logo, which `pnpm deploy` does not carry.
#
# `/out` is the built bundle plus production `node_modules`, and nothing else:
# a file that is only ever `readFile`d at runtime is invisible to both esbuild
# and pnpm, so these three arrived in every local run and in no image. The
# symptom was a card request failing with "Card asset not found: badge.png"
# while the same code drew cards perfectly from source.
#
# `dist/assets` rather than anywhere else because `modules/cards/render.ts`
# already looks beside the bundle — that is the root which is the same whether
# the code runs from `dist/index.js` or from source under tsx.
COPY --from=build --chown=node:node /app/apps/api/assets ./dist/assets

USER node
EXPOSE 8080
CMD ["node", "dist/index.js"]
