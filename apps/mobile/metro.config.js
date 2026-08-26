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

module.exports = config
