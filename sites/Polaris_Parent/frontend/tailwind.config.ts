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
      // 品牌規範 v3：docs/BRAND_GUIDELINES.md 是公開站視覺的唯一依據
      fontFamily: {
        // 後台沿用：拉丁字優先 Inter，中文一律微軟正黑體（瀏覽器逐字選字）
        sans: [
          'var(--font-inter)',
          '"Microsoft JhengHei"',
          '"微軟正黑體"',
          'system-ui',
          'sans-serif',
        ],
        // 公開站：標題粉圓（只有 400）、內文思源黑體、數字與英文 Archivo
        heading: ['var(--font-huninn)', '"Zen Maru Gothic"', 'sans-serif'],
        body: ['var(--font-noto)', '"Microsoft JhengHei"', 'system-ui', 'sans-serif'],
        latin: ['var(--font-archivo)', 'sans-serif'],
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
        // 規範的 muted（#6b7084）與 shadcn 的 muted 撞名：後台大量用 bg-muted，
        // 所以保留 HSL 變數寫法，由 globals.css 在 .public-site 內把 --muted 改成品牌值。
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
        // 品牌跳色：刻意覆寫 Tailwind 預設的 blue / pink 色階，避免誤用預設藍
        blue: { 50: '#eef5ff', 100: '#dceaff', 200: '#b5d3ff', 300: '#7fb2fb', 400: '#3d8af2', 500: '#0967e7', 600: '#0753bd', 700: '#064196', 800: '#08326f', 900: '#0b2349' },
        pink: { 50: '#fff0f7', 100: '#ffdcec', 200: '#ffb3d6', 300: '#ff7ab8', 400: '#ff3d9b', 500: '#ff0084', 600: '#d6006f', 700: '#a8005a', 800: '#7a0743', 900: '#4d0a2d' },
        // 基礎色
        ink: '#1f2333',
        text: '#4b5063',
        line: { DEFAULT: '#e3e5ee', strong: '#c6c9d4' },
        tint: '#f3f1ec',
        paper: '#fcfaf6',
        surface: '#ffffff',
        // 輔助色：只用在插畫、圖示、標籤，不可用在按鈕和連結
        star: { 100: '#fff4d6', 500: '#ffc23d', 800: '#8a5a00' },
        leaf: { 100: '#dcf5ea', 500: '#21b07a', 800: '#0f6646' },
        // 語意色：系統回饋專用（錯誤偏橘紅，刻意與品牌粉拉開）
        success: { DEFAULT: '#1f9d68', bg: '#dcf5ea', fg: '#0f6646' },
        warning: { DEFAULT: '#e09b00', bg: '#fff4d6', fg: '#8a5a00' },
        error: { DEFAULT: '#e0482a', bg: '#fdebe6', fg: '#9c2a14' },
        // @deprecated 品牌規範 v3 已停用紫色與暖色系，本站程式碼已全部換掉。
        // 仍保留這兩組 key，是因為共用套件（@ows/ziwei-app、site-kit 等，Happy_Wu 也在用）寫死了這些 class；
        // 在本站把它們重新對應到品牌色，套件元件在 Polaris 上就會跟著品牌走，又不必改動共用套件。
        'brand-purple': {
          50: '#eef5ff',
          100: '#dceaff',
          200: '#b5d3ff',
          300: '#7fb2fb',
          400: '#3d8af2',
          500: '#0967e7',
          600: '#0967e7',
          700: '#0753bd',
          800: '#08326f',
          900: '#0b2349',
          950: '#0b2349',
        },
        warm: {
          50: '#fcfaf6',
          100: '#f3f1ec',
          200: '#e3e5ee',
          300: '#c6c9d4',
          400: '#c6c9d4',
          500: '#6b7084',
          600: '#6b7084',
          700: '#4b5063',
          800: '#4b5063',
          900: '#1f2333',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        // 全站「Banner / 卡片」統一圓角：只要改 globals.css 的 --radius-banner 即可一次調整全部
        banner: 'var(--radius-banner)',
        xl2: '40px',
        card: '32px',
        inner: '20px',
        sm2: '12px',
      },
      backgroundImage: {
        'btn-primary': 'var(--btn-primary)',
        'btn-accent': 'var(--btn-accent)',
        'btn-secondary': 'var(--btn-secondary)',
        'btn-soft': 'var(--btn-soft)',
      },
      // 帶藍色調的輕陰影（後台共用同一組 key，色調一併變淡，屬預期）
      boxShadow: {
        sm: '0 2px 6px rgba(9,40,100,.06)',
        md: '0 10px 30px rgba(9,40,100,.10)',
        lg: '0 24px 60px rgba(9,40,100,.16)',
      },
      // 字級（桌面值）；手機用 text-[40px] md:text-display 這類寫法
      fontSize: {
        display: ['56px', { lineHeight: '1.25' }],
        h1: ['44px', { lineHeight: '1.3' }],
        h2: ['34px', { lineHeight: '1.35' }],
        h3: ['26px', { lineHeight: '1.4' }],
        h4: ['20px', { lineHeight: '1.45' }],
        lead: ['19px', { lineHeight: '1.8' }],
        body: ['17px', { lineHeight: '1.85' }],
        small: ['14px', { lineHeight: '1.7' }],
        caption: ['13px', { lineHeight: '1.6' }],
      },
      maxWidth: {
        content: '1200px',
        prose: '640px',
      },
      // @tailwindcss/typography 的 prose 覆寫（品牌規範 §4.3）
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-body': '#4b5063',
            '--tw-prose-headings': '#1f2333',
            '--tw-prose-links': '#0967e7',
            '--tw-prose-bold': '#1f2333',
            '--tw-prose-counters': '#6b7084',
            '--tw-prose-bullets': '#0967e7',
            '--tw-prose-hr': '#e3e5ee',
            '--tw-prose-quotes': '#08326f',
            '--tw-prose-captions': '#6b7084',
            '--tw-prose-th-borders': '#c6c9d4',
            '--tw-prose-td-borders': '#e3e5ee',
            'h1, h2, h3, h4': {
              fontFamily: 'var(--font-huninn), "Zen Maru Gothic", sans-serif',
              fontWeight: '400',
              color: '#1f2333',
            },
            a: { textUnderlineOffset: '3px', transition: 'color 150ms ease-out' },
            'a:hover': { color: '#d6006f' },
            blockquote: {
              backgroundColor: '#eef5ff',
              color: '#08326f',
              borderRadius: '20px',
              padding: '1.25rem 1.5rem',
              fontFamily: 'var(--font-huninn), "Zen Maru Gothic", sans-serif',
              fontStyle: 'normal',
              fontWeight: '400',
              borderLeftWidth: '0',
            },
            'blockquote p:first-of-type::before': { content: 'none' },
            'blockquote p:last-of-type::after': { content: 'none' },
            mark: { background: 'linear-gradient(transparent 60%, #ffb3d6 60%)', color: 'inherit' },
            img: { borderRadius: '32px' },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
export default config