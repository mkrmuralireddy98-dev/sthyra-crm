/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@plumb/tokens', '@plumb/observability'],
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
