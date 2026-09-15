import type { Config } from 'tailwindcss'

const config: Config = {
  // 深色模式由後台外殼在根節點加 `dark` class 切換（AdminLabeledShell），不跟系統偏好走。
  // 公開站目前沒有任何 dark: 變體，所以這個設定只影響後台。
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    // 共用套件：所有 @ows/* 都要掃，否則只出現在套件裡的 class 不會被產進 CSS
    //（P3 把後台外殼抽到 admin-app 後，側欄寬度／深色底就是這樣消失的）
    '../../../packages/*/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // 拉丁字優先 Inter，中文一律微軟正黑體（瀏覽器逐字選字）
        sans: [
          'var(--font-inter)',
          '"Microsoft JhengHei"',
          '"微軟正黑體"',
          'system-ui',
          'sans-serif',
        ],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        'admin-accent': {
          50: 'hsl(var(--admin-accent-50))',
          100: 'hsl(var(--admin-accent-100))',
          200: 'hsl(var(--admin-accent-200))',
          500: 'hsl(var(--admin-accent-500))',
          600: 'hsl(var(--admin-accent-600))',
          700: 'hsl(var(--admin-accent-700))',
          800: 'hsl(var(--admin-accent-800))',
        },
        'brand-purple': {
          50: '#faf7ff',
          100: '#f3edff',
          200: '#e8ddff',
          300: '#d7c3ff',
          400: '#be9eff',
          500: '#a371ff',
          600: '#8b5cf6',
          700: '#7c3aed',
          800: '#6d28d9',
          900: '#5b21b6',
          950: '#3b0764',
        },
        warm: {
          50: '#fdfcf8',
          100: '#faf8f0',
          200: '#f5f0e0',
          300: '#ede4c8',
          400: '#e3d5a8',
          500: '#d6c287',
          600: '#c9ad6b',
          700: '#b8955a',
          800: '#967b4d',
          900: '#7a6542',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        // 全站「Banner / 卡片」統一圓角：只要改 globals.css 的 --radius-banner 即可一次調整全部
        banner: 'var(--radius-banner)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
export default config