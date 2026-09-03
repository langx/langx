// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// @langx/shared is consumed as TypeScript source, so Metro has to watch the
// whole workspace, not just this app.
config.watchFolders = [workspaceRoot]

// NOTE: do NOT set `disableHierarchicalLookup` or override `nodeModulesPaths`
// here. That advice belongs to flat npm/Yarn monorepos; pnpm stores packages
// under `.pnpm/<name>/node_modules`, so Metro must be allowed to walk up the
// tree or transitive deps like `expo-modules-core` stop resolving.

// Metro spawns one transformer worker per core, and on a many-core machine the
// release bundle step (`:app:createBundleReleaseJsAndAssets`) dies with
// `Cannot read properties of undefined (reading 'transformFile')` — the pool
// hands back a worker that never finished starting. Capping it trades a little
// bundling speed for a build that finishes.
config.maxWorkers = 2

module.exports = config
