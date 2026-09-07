#!/usr/bin/env python3
"""
站台產生器 —— 開一個新站台。

## 產出什麼

    sites/<Name>/
      .env.example              需要設定的環境變數
      __init__.py
      backend/
        __init__.py
        app.py                  ~40 行：只寫站名與擴充
        config.py               ~20 行：繼承 BaseSiteConfig
        extensions/__init__.py  站台專屬 blueprint 放這裡
        migrations/             站台鏈（只管站台自己的表）
      frontend/
        package.json / tsconfig.json / next.config.js
        src/app/admin/**        11 個一行 re-export，掛上共用後台
        src/app/layout.tsx      注入站台識別到 @ows/site-kit
        src/siteConfig.ts
        src/lib/utils.ts        圖片 URL 規則（各站不同，必須自己寫）

平台能力全部來自套件，不複製：
    @ows/platform-api  API client + 登入狀態
    @ows/admin-app     整套後台
    @ows/site-kit      SEO / 結構元件
    @ows/content-kit   文章內容解析
    core/migrations    平台資料表（共用鏈）

## 用法

    python scripts/create_site.py Demo
    python scripts/create_site.py Demo --port 5010 --force

產生之後：
    1. cp sites/Demo/.env.example sites/Demo/.env  並填入實際值
    2. npm install
    3. flask --app sites.Demo.backend.app:app db upgrade -d core/migrations
       flask --app sites.Demo.backend.app:app db upgrade -d sites/Demo/backend/migrations
    4. npm run dev --workspace=demo-frontend
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# 共用後台的頁面 → 站台路由。加新頁面時這裡跟著加一行。
ADMIN_PAGES = {
    'articles': 'articles/index',
    'authors': 'authors/index',
    'categories': 'categories/index',
    'media': 'media/index',
    'products': 'products/index',
    'dashboard': 'dashboard',
    'homepage': 'homepage',
    'login': 'login',
    'roles': 'roles',
    'settings': 'settings',
    'submissions': 'submissions',
}

WORKSPACE_PACKAGES = [
    '@ows/admin-app', '@ows/content-kit', '@ows/platform-api',
    '@ows/site-kit', '@ows/ui',
]


def slug(name: str) -> str:
    """'Demo Site' → 'demo-site'"""
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')


def build_backend(site: Path, name: str, port: int) -> None:
    write(site / '__init__.py', '')
    write(site / 'backend' / '__init__.py', '')
    write(site / 'backend' / 'extensions' / '__init__.py',
          '"""站台專屬 blueprint 放這裡；掛載方式見 app.py 的 SITE_EXTENSIONS。"""\n')

    write(site / 'backend' / 'config.py', f'''"""
{name} — 站台設定

共用設定在 core.backend_engine.site_config.BaseSiteConfig，這裡只寫本站不同的部分。
"""

import os

from dotenv import load_dotenv

from core.backend_engine.site_config import BaseSiteConfig, make_config_registry

SITE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 不加 override=True：平台（Railway / Vercel 等）設定的環境變數應該優先於檔案，
# 否則映像檔裡帶著的 .env 會蓋掉正式環境的設定。
load_dotenv(os.path.join(SITE_DIR, '.env'))


class Config(BaseSiteConfig):
    SITE_NAME = os.environ.get('SITE_NAME', '{name}')
    SITE_DIR = SITE_DIR


config = make_config_registry(Config, dev_database='ows_{slug(name).replace("-", "_")}_dev')
''')

    write(site / 'backend' / 'app.py', f'''"""
{name} — Application Entry Point

樣板全部在 core.backend_engine.site_scaffold；這裡只寫本站真正獨有的事。

Usage:
    python app.py
    gunicorn -w 4 -b 0.0.0.0:{port} "sites.{name}.backend.app:app"
"""

import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from core.backend_engine.site_scaffold import create_site_app, run_dev_server  # noqa: E402
from sites.{name}.backend.config import config  # noqa: E402

SITE_NAME = '{name}'

# 站台專屬擴充。範例：
#     BlueprintConfig(
#         module_path='sites.{name}.backend.extensions.my_feature',
#         url_prefix='/api/v1/my-feature',
#     )
SITE_EXTENSIONS = []

app = create_site_app(
    site_package='sites.{name}.backend',
    site_name=SITE_NAME,
    config_registry=config,
    extensions=SITE_EXTENSIONS,
)


if __name__ == '__main__':
    run_dev_server(app, SITE_NAME)
''')

    write(site / '.env.example', f'''# {name} — 環境變數
# cp .env.example .env 後填入實際值

FLASK_CONFIG=development
FLASK_PORT={port}

SECRET_KEY=change-me
JWT_SECRET_KEY=change-me

DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/ows_{slug(name).replace("-", "_")}_dev
CORS_ORIGINS=http://localhost:{port + 3000 - 5000}

# 平台資料表的 schema 佈局（不設 = 全部落在 public）。見 docs/MIGRATIONS.md
# OWS_BLOG_SCHEMA=blog
# OWS_SHOP_SCHEMA=shop

# 身分模型：local = 自己的 users 表；external = 外部身分系統
# OWS_IDENTITY_MODE=local

# 會員系統（core 的 /api/v1/auth/member/*），預設關閉
# MEMBER_AUTH_ENABLED=true
''')

    # 站台鏈：只管站台自己的表。平台表走 core/migrations。
    src = REPO / 'sites' / 'Polaris_Parent' / 'backend' / 'migrations'
    dst = site / 'backend' / 'migrations'
    dst.mkdir(parents=True, exist_ok=True)
    for f in ('alembic.ini', 'script.py.mako', 'README', 'env.py'):
        if (src / f).exists():
            shutil.copy(src / f, dst / f)
    (dst / 'versions').mkdir(exist_ok=True)
    write(dst / 'versions' / '.gitkeep', '')


def build_frontend(site: Path, name: str, port: int) -> None:
    fe = site / 'frontend'
    fe_port = port + 3000 - 5000
    pkg_slug = slug(name)

    polaris_fe = REPO / 'sites' / 'Polaris_Parent' / 'frontend'
    base_pkg = json.loads((polaris_fe / 'package.json').read_text(encoding='utf-8'))
    deps = {k: v for k, v in base_pkg['dependencies'].items()}
    base_pkg.update({
        'name': f'{pkg_slug}-frontend',
        'scripts': {
            'dev': f'next dev --turbo --port {fe_port}',
            'build': 'next build',
            'start': 'next start',
            'lint': 'next lint',
        },
        'dependencies': dict(sorted(deps.items())),
    })
    write(fe / 'package.json', json.dumps(base_pkg, indent=2, ensure_ascii=False) + '\n')

    tsconfig = json.loads((polaris_fe / 'tsconfig.json').read_text(encoding='utf-8'))
    write(fe / 'tsconfig.json', json.dumps(tsconfig, indent=2, ensure_ascii=False) + '\n')

    nextcfg = (polaris_fe / 'next.config.js').read_text(encoding='utf-8')
    nextcfg = nextcfg.replace('http://127.0.0.1:5000', f'http://127.0.0.1:{port}')
    nextcfg = nextcfg.replace("port: '5000'", f"port: '{port}'")

    # Polaris 的正式 API 網域不能跟著複製過來 —— 否則新站台的 images.remotePatterns
    # 會允許 api.polaris-parent.com，而且 scripts/check_site_isolation.py 會在建置產物
    # （required-server-files.json / standalone server.js）裡抓到它。改成由環境變數提供。
    polaris_domain_block = """      // 生產環境 API 域名（Railway custom domain）
      {
        protocol: 'https',
        hostname: 'api.polaris-parent.com',
        pathname: '/uploads/**',
      },
"""
    generic_domain_block = """      // 正式環境 API 網域：由 NEXT_PUBLIC_API_HOSTNAME 提供（例如 api.example.com）。
      // 不設就只允許 localhost / Railway 預設網域 / GCS。
      ...(process.env.NEXT_PUBLIC_API_HOSTNAME
        ? [{ protocol: 'https', hostname: process.env.NEXT_PUBLIC_API_HOSTNAME, pathname: '/uploads/**' }]
        : []),
"""
    assert polaris_domain_block in nextcfg, 'Polaris next.config.js 的 remotePatterns 格式變了，請更新產生器'
    nextcfg = nextcfg.replace(polaris_domain_block, generic_domain_block, 1)
    write(fe / 'next.config.js', nextcfg)

    for f in ('postcss.config.js', 'tailwind.config.ts', 'next-env.d.ts', '.eslintrc.json'):
        if (polaris_fe / f).exists():
            shutil.copy(polaris_fe / f, fe / f)

    # 後台：每頁一行 re-export
    for route, page in ADMIN_PAGES.items():
        write(fe / 'src' / 'app' / 'admin' / route / 'page.tsx',
              f"export {{ default }} from '@ows/admin-app/pages/{page}';\n")

    write(fe / 'src' / 'app' / 'admin' / 'layout.tsx', f'''\'use client\';

/**
 * 後台路由外殼。實作在 @ows/admin-app —— 這裡只注入站台專屬設定。
 */

import {{ AdminShell, configureAdminApp, ALL_MODULES }} from '@ows/admin-app';
import {{ getImageUrl, getGcsImageUrl }} from '@/lib/utils';

configureAdminApp({{
  siteName: '{name}',
  // 啟用的平台模組。純部落格站台可拿掉 'products'：
  //   modules: ALL_MODULES.filter((m) => m !== 'products'),
  // 關掉的模組不只藏選單，直接猜網址也會被導回儀表板。
  modules: ALL_MODULES,
  getImageUrl,
  getGcsImageUrl,
  // 站台自己的後台頁面掛這裡，會出現在側邊選單
  extraNav: [],
}});

export default function AdminRouteLayout({{ children }}: {{ children: React.ReactNode }}) {{
  return <AdminShell>{{children}}</AdminShell>;
}}
''')

    write(fe / 'src' / 'siteConfig.ts', f'''/**
 * {name} 的站台識別 —— 注入 @ows/site-kit。
 *
 * 必須在任何讀取設定的程式之前載入，所以 app/layout.tsx 第一行 import 它。
 */

import {{ configureSiteKit }} from '@ows/site-kit/config';
import {{ getImageUrl, getGcsImageUrl }} from '@/lib/utils';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:{fe_port}').replace(/\\/$/, '');
const SITE_NAME = '{name}';

configureSiteKit({{
  siteUrl: SITE_URL,
  siteName: SITE_NAME,
  defaultLocale: 'zh-TW',
  supportedLocales: ['zh-TW', 'en'],
  organization: {{
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${{SITE_URL}}/logo.png`,
  }},
  getImageUrl,
  getGcsImageUrl,
}});

export {{ SITE_URL, SITE_NAME }};
''')

    write(fe / 'src' / 'lib' / 'utils.ts', '''/**
 * 站台專用 utils。
 *
 * 純 utility 從 @ows/ui 共用；圖片 URL 規則**必須各站自己寫** ——
 * 實測 Polaris 用後綴（name_thumbnail.jpg）、Claire 用前綴（thumbnail_name.jpg），
 * 兩邊都對，就是不一樣，套件不能替你猜。
 */

export {
  cn,
  formatDate,
  formatDateTime,
  truncateText,
  slugify,
  generateMetaTitle,
  generateMetaDescription,
  isValidEmail,
  isValidUrl,
  debounce,
  getCategoryPath,
  buildCategoryTree,
} from '@ows/ui/lib/utils';

export function getImageUrl(imagePath?: string, variant?: string): string {
  if (!imagePath) return '/placeholder.jpg';
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;

  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
  const fullPath = `${baseUrl}${imagePath}`;
  if (!variant) return fullPath;

  // 預設採後綴式（filename_variant.ext）。若後端產出的是前綴式，改這裡。
  const dot = fullPath.lastIndexOf('.');
  return dot === -1
    ? fullPath
    : `${fullPath.substring(0, dot)}_${variant}${fullPath.substring(dot)}`;
}

export function getGcsImageUrl(imagePath: string, variant?: string): string {
  if (!imagePath) return '/placeholder.jpg';
  if (!variant) return imagePath;
  if (!imagePath.includes('storage.googleapis.com')) return getImageUrl(imagePath, variant);

  const slash = imagePath.lastIndexOf('/');
  if (slash === -1) return imagePath;
  const dir = imagePath.substring(0, slash + 1);
  const filename = imagePath.substring(slash + 1).replace(/^(thumbnail|small|medium|large)_/, '');
  return `${dir}${variant}_${filename}`;
}
''')

    write(fe / 'src' / 'types' / 'index.ts',
          "export * from '@ows/platform-api/types';\n")
    write(fe / 'src' / 'hooks' / 'index.ts',
          "export { useDebounce } from '@ows/ui/hooks';\n")
    write(fe / 'src' / 'lib' / 'api' / 'index.ts', '''/**
 * API barrel —— 平台能力來自 @ows/platform-api，站台領域 API 加在下方。
 */
export * from '@ows/platform-api';
''')

    write(fe / 'src' / 'app' / 'layout.tsx', f'''// 必須最先載入：注入站台識別到 @ows/site-kit
import '@/siteConfig';
import type {{ Metadata }} from 'next';
import './globals.css';

export const metadata: Metadata = {{
  title: '{name}',
  description: '{name}',
}};

export default function RootLayout({{ children }}: {{ children: React.ReactNode }}) {{
  return (
    <html lang="zh-TW">
      <body>{{children}}</body>
    </html>
  );
}}
''')

    write(fe / 'src' / 'app' / 'page.tsx', f'''export default function HomePage() {{
  return (
    <main style={{{{ padding: '3rem', fontFamily: 'system-ui' }}}}>
      <h1>{name}</h1>
      <p>
        後台已就緒：<a href="/admin/dashboard">/admin/dashboard</a>
      </p>
      <p>公開頁請用 @ows/site-kit 的元件自行組裝。</p>
    </main>
  );
}}
''')

    globals_css = polaris_fe / 'src' / 'app' / 'globals.css'
    if globals_css.exists():
        shutil.copy(globals_css, fe / 'src' / 'app' / 'globals.css')


def register_workspace(name: str) -> None:
    """把新站台的前端加進 npm workspace 與根 package.json 的 scripts。"""
    p = REPO / 'package.json'
    d = json.loads(p.read_text(encoding='utf-8'))
    key = f'dev:{slug(name)}'
    if key not in d['scripts']:
        d['scripts'][key] = f'npm run dev --workspace={slug(name)}-frontend'
        d['scripts'][f'build:{slug(name)}'] = f'npm run build --workspace={slug(name)}-frontend'
        p.write_text(json.dumps(d, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('name', help='站台名稱，例如 Demo（會成為 sites/<Name>/）')
    ap.add_argument('--port', type=int, default=5010, help='後端埠號（前端用 port-2000）')
    ap.add_argument('--force', action='store_true', help='覆蓋既有目錄')
    args = ap.parse_args()

    if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]*', args.name):
        print(f"✗ 站台名稱必須是合法的 Python 識別字（英數與底線）：{args.name}")
        return 1

    site = REPO / 'sites' / args.name
    if site.exists():
        if not args.force:
            print(f"✗ {site.relative_to(REPO)} 已存在。要覆蓋請加 --force。")
            return 1
        shutil.rmtree(site)

    print(f"建立站台 {args.name}（後端 :{args.port}／前端 :{args.port - 2000}）\n")
    build_backend(site, args.name, args.port)
    print("  ✓ 後端骨架（app.py / config.py / extensions / migrations）")
    build_frontend(site, args.name, args.port)
    print(f"  ✓ 前端骨架（{len(ADMIN_PAGES)} 個後台頁面各一行 re-export）")
    register_workspace(args.name)
    print("  ✓ 已加入 npm workspace")

    print(f"""
接下來：
  1. cp sites/{args.name}/.env.example sites/{args.name}/.env   並填入實際值
  2. npm install
  3. flask --app sites.{args.name}.backend.app:app db upgrade -d core/migrations
     flask --app sites.{args.name}.backend.app:app db upgrade -d sites/{args.name}/backend/migrations
  4. npm run dev:{slug(args.name)}
""")
    return 0


if __name__ == '__main__':
    sys.exit(main())
