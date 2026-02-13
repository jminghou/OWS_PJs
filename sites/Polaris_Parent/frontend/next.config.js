// 多語言功能目前關閉
// 啟用多語言時取消下方註解:
// const createNextIntlPlugin = require('next-intl/plugin');
// const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 生產環境使用 standalone 輸出（Docker 部署用，本機 dev 不受影響）
  output: 'standalone',

  // 轉譯 monorepo 內的套件
  transpilePackages: ['@ows/ui'],
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '5000',
        pathname: '/uploads/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '5000',
        pathname: '/uploads/**',
      },
      // NAS 內網存取
      {
        protocol: 'http',
        hostname: '192.168.30.65',
        port: '5001',
        pathname: '/uploads/**',
      },
      // 生產環境 API 域名
      {
        protocol: 'https',
        hostname: 'api.polaris-parent.com',
        pathname: '/uploads/**',
      },
      // 生產環境 GCS bucket
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: '/**',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000/api/v1',
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  // API Proxy: 前端請求 /api/v1/* 代理轉發到後端
  // Docker 環境透過 NEXT_SERVER_BACKEND_URL 走容器內部網路
  async rewrites() {
    const backendUrl = process.env.NEXT_SERVER_BACKEND_URL
      || process.env.NEXT_PUBLIC_BACKEND_URL
      || 'http://127.0.0.1:5000';
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
}

// 多語言關閉時直接導出 nextConfig
// 啟用多語言時改為: module.exports = withNextIntl(nextConfig);
module.exports = nextConfig;
