const { composePlugins, withNx } = require('@nx/webpack');
const path = require('path');

// Nx plugins for webpack.
module.exports = composePlugins(withNx(), (config) => {
  // Better Auth is ESM-only; bundle it so the CommonJS Nx node runner can load it.
  config.externals = [
    (context, callback) => {
      const request = context.request || '';
      if (!request || request.startsWith('.') || request.startsWith('/') ||
        request.startsWith('@jibu/')) {
        return callback();
      }
      if (request === 'better-auth' || request.startsWith('better-auth/') ||
        request === '@better-auth/' || request.startsWith('@better-auth/') ||
        request === '@noble/hashes' || request.startsWith('@noble/hashes/') ||
        request === '@noble/ciphers' || request.startsWith('@noble/ciphers/') ||
        request === 'better-call' || request.startsWith('better-call/') ||
        request === 'defu' || request.startsWith('defu/') ||
        request === '@better-fetch/fetch' || request.startsWith('@better-fetch/fetch/') ||
        request === 'rou3' || request.startsWith('rou3/')) {
        return callback();
      }
      if (request === 'zod' || request.startsWith('zod/')) {
        return callback();
      }
      if (request === 'kysely' || request.startsWith('kysely/')) {
        return callback();
      }
      if (request === 'jose' || request.startsWith('jose/')) {
        return callback();
      }
      return callback(null, `commonjs ${request}`);
    },
  ];
  config.resolve = {
    ...config.resolve,
    alias: {
      ...config.resolve?.alias,
      zod$: path.resolve(__dirname, '../../node_modules/.pnpm/zod@4.4.3/node_modules/zod'),
    },
  };
  return config;
});
