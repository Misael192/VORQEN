/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Empacota o pacote workspace TS-fonte (Opção A: IA roda no browser).
  transpilePackages: ['@vorqen/ai-core'],
  experimental: {
    typedRoutes: true
  }
};

export default nextConfig;
