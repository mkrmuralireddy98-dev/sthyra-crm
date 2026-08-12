/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@sthyra-crm/tokens', '@sthyra-crm/observability'],
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
