// 多語言功能目前關閉
// 啟用多語言時取消下方註解:
// const createNextIntlPlugin = require('next-intl/plugin');
// const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone 用於 Docker/Railway 部署；Vercel 不需要
  ...(process.env.VERCEL ? {} : { output: 'standalone' }),

  // 轉譯 monorepo 內的套件
  transpilePackages: ['@ows/ui', '@ows/ziwei-chart', '@ows/platform-api', '@ows/admin-app', '@ows/content-kit', '@ows/site-kit', '@ows/ziwei-app', '@ows/commerce'],

  // 以「路徑別名」解析 @ows/ziwei-chart（指向 monorepo 原始碼），不依賴 workspace symlink，
  // 讓 Vercel 子目錄建置也能解析（與 @ows/ui 用相對路徑的做法一致，修正長期建置失敗）。
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@ows/ziwei-app$': path.resolve(__dirname, '../../../packages/ziwei-app/src/index.ts'),
      '@ows/ziwei-app': path.resolve(__dirname, '../../../packages/ziwei-app/src'),
      '@ows/ziwei-chart$': path.resolve(__dirname, '../../../packages/ziwei-chart/src/index.ts'),
      '@ows/ziwei-chart/core': path.resolve(__dirname, '../../../packages/ziwei-chart/src/core/index.ts'),
      // 與 tsconfig paths 對齊。既有的六層相對路徑 import 仍可用，
      // 但新程式碼一律走 @ows/ui，之後把元件搬進 packages 時不必再改 import。
      '@ows/site-kit$': path.resolve(__dirname, '../../../packages/site-kit/src/index.ts'),
      '@ows/site-kit': path.resolve(__dirname, '../../../packages/site-kit/src'),
      '@ows/commerce$': path.resolve(__dirname, '../../../packages/commerce/src/index.ts'),
      '@ows/commerce': path.resolve(__dirname, '../../../packages/commerce/src'),
      '@ows/admin-app$': path.resolve(__dirname, '../../../packages/admin-app/src/index.ts'),
      '@ows/admin-app': path.resolve(__dirname, '../../../packages/admin-app/src'),
      '@ows/content-kit$': path.resolve(__dirname, '../../../packages/content-kit/src/index.ts'),
      '@ows/content-kit': path.resolve(__dirname, '../../../packages/content-kit/src'),
      '@ows/platform-api$': path.resolve(__dirname, '../../../packages/platform-api/src/index.ts'),
      '@ows/platform-api': path.resolve(__dirname, '../../../packages/platform-api/src'),
      '@ows/ui$': path.resolve(__dirname, '../../../packages/ui/src/index.ts'),
      '@ows/ui': path.resolve(__dirname, '../../../packages/ui/src'),
    };
    return config;
  },
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
      // 生產環境 API 域名（Railway custom domain）
      {
        protocol: 'https',
        hostname: 'api.polaris-parent.com',
        pathname: '/uploads/**',
      },
      // Railway 預設域名
      {
        protocol: 'https',
        hostname: '*.up.railway.app',
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
