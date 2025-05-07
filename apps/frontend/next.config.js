//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');
const path = require('path');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {
    // Set this to true if you would like to use SVGR
    // See: https://github.com/gregberge/svgr
    svgr: false,
  },
  // Server components external packages
  serverComponentsExternalPackages: ['ioredis'],
  
  // Add Node.js polyfills for client-side
  webpack: (config, { isServer }) => {
    // Add polyfills for Node.js modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        dns: false,
        tls: false,
        fs: false,
        path: false,
      };
    }
    
    // Fix path resolution for libs
    const workspace = path.resolve(__dirname, '../..');
    
    // Add aliases for path mapping
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.join(__dirname, 'src'),
      'libs': path.join(workspace, 'libs'),
      '@libs': path.join(workspace, 'libs'),
      
      // Add specific aliases for shadcn-ui components
      '@libs/shadcn-ui/lib/utils': path.join(workspace, 'libs/shadcn-ui/src/lib/utils'),
      '@libs/shadcn-ui/lib': path.join(workspace, 'libs/shadcn-ui/src/lib'),
      '@libs/shadcn-ui/hooks': path.join(workspace, 'libs/shadcn-ui/src/hooks'),
      '@libs/shadcn-ui/components': path.join(workspace, 'libs/shadcn-ui/src/components')
    };
    
    return config;
  },
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
