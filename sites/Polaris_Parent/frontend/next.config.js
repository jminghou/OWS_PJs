// 多語言功能目前關閉
// 啟用多語言時取消下方註解:
// const createNextIntlPlugin = require('next-intl/plugin');
// const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
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
      // 生產環境 GCS bucket（部署時替換為實際 bucket 域名）
      ...(process.env.GCS_BUCKET_NAME ? [{
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: `/${process.env.GCS_BUCKET_NAME}/**`,
      }] : []),
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
}

// 多語言關閉時直接導出 nextConfig
// 啟用多語言時改為: module.exports = withNextIntl(nextConfig);
module.exports = nextConfig;
