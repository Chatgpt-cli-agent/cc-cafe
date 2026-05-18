/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js config for static export
  output: 'export',
  trailingSlash: false,
  devIndicators: false,

  // Static export uses unoptimized remote images in Electron.
  images: {
    unoptimized: true,
  },

  staticPageGenerationTimeout: 1000,
};

module.exports = nextConfig;
