// Expo Metro config with a targeted workaround for @getpaseo/relay@0.1.100, whose
// package.json "exports" map points its `import`/`default` conditions at src/*.ts
// files that are not shipped (only dist/* is published). Metro picks the `import`
// condition and fails. We alias the relay subpaths to their real built dist files.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// require.resolve uses the Node condition -> dist/index.js, so this resolves to the
// package's dist directory regardless of hoisting.
const relayDist = path.dirname(require.resolve("@getpaseo/relay"));
const relayAliases = {
  "@getpaseo/relay": path.join(relayDist, "index.js"),
  "@getpaseo/relay/e2ee": path.join(relayDist, "e2ee.js"),
  "@getpaseo/relay/cloudflare": path.join(relayDist, "cloudflare-adapter.js"),
};

const previousResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const alias = relayAliases[moduleName];
  if (alias) {
    return { type: "sourceFile", filePath: alias };
  }
  const next = previousResolveRequest ?? context.resolveRequest;
  return next(context, moduleName, platform);
};

module.exports = config;
