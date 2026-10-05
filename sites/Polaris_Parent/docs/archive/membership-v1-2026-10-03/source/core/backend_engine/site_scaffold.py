"""
站台後端骨架 —— 把 app.py 的樣板收斂成一個呼叫。

## 為什麼需要這個模組

在此之前每個站台的 app.py 約 190 行，兩站實測只差 33 行，而那 33 行**幾乎全是
站名字串**。也就是說開一個新站台，第一件事是複製 190 行樣板 —— 路徑設定、
config 選擇、model 匯入、媒體庫掛載、CLI 指令、開發伺服器 banner，每一樣都一樣。

現在站台的 app.py 只需要說出它真正獨有的事：叫什麼名字、掛哪些擴充。

    from core.backend_engine.site_scaffold import create_site_app
    from sites.Demo.backend.config import config

    app = create_site_app(
        site_package='sites.Demo.backend',
        site_name='Demo',
        config_registry=config,
        extensions=[],
    )

## 擴充點

樣板之外的需求走 before_init / after_init hook，與 core factory 的介面一致。
CLI 指令預設提供 init-site 與 create-admin，站台可用 cli_commands 追加。
"""

from __future__ import annotations

import os
from importlib import import_module
from typing import Callable, Iterable, Optional, Sequence

from flask import Flask

from core.backend_engine.factory import BlueprintConfig, create_app


def _select_config(config_registry: dict):
    """依 FLASK_CONFIG 選出設定類別。"""
    name = os.environ.get('FLASK_CONFIG', 'development')
    return config_registry.get(name, config_registry.get('default'))


def _register_default_cli(app: Flask, site_name: str) -> None:
    """每個站台都需要的 CLI 指令。"""
    import click

    @app.cli.command('init-site')
    def init_site():
        """Initialize site-specific data."""
        click.echo(f'Initializing {site_name} site data...')
        click.echo('Done!')

    @app.cli.command('create-admin')
    @click.option('--username', prompt=True, help='Admin username')
    @click.option('--email', prompt=True, help='Admin email')
    @click.option('--password', prompt=True, hide_input=True, confirmation_prompt=True)
    def create_admin(username, email, password):
        """Create an admin user."""
        from core.backend_engine.factory import db
        from core.backend_engine.models import User

        with app.app_context():
            if User.query.filter_by(username=username).first():
                click.echo(f'User {username} already exists!')
                return

            user = User(username=username, email=email, role='admin', is_active=True)
            user.set_password(password)
            db.session.add(user)
            db.session.commit()
            click.echo(f'Admin user {username} created successfully!')


def create_site_app(
    *,
    site_package: str,
    site_name: str,
    config_registry: dict,
    extensions: Sequence[BlueprintConfig] = (),
    default_language: str = 'zh-TW',
    supported_languages: Sequence[str] = ('zh-TW', 'en'),
    enable_media_lib: bool = True,
    skip_blueprints: Optional[Sequence[str]] = None,
    before_init: Optional[Callable[[Flask], None]] = None,
    after_init: Optional[Callable[[Flask], None]] = None,
    cli_commands: Iterable[Callable[[Flask], None]] = (),
) -> Flask:
    """建立站台的 Flask app。

    Args:
        site_package:        站台後端的匯入路徑，例如 'sites.Demo.backend'。
                             用來自動匯入該站的 models（若有）。
        site_name:           站名，進 app.config['SITE_NAME'] 並用於 log。
        config_registry:     站台 config 模組的 `config` 字典。
        extensions:          站台專屬的 BlueprintConfig。
        enable_media_lib:    是否掛載 packages/media_lib（預設掛）。
        before_init/after_init: 樣板之外的初始化需求。
        cli_commands:        追加的 CLI 註冊函式，簽名 fn(app)。
    """

    def _before(app: Flask) -> None:
        app.config.setdefault('SITE_NAME', site_name)
        app.config.setdefault('DEFAULT_LANGUAGE', default_language)
        app.config.setdefault('SUPPORTED_LANGUAGES', list(supported_languages))
        if before_init:
            before_init(app)

    def _after(app: Flask) -> None:
        _register_default_cli(app, site_name)
        for register in cli_commands:
            register(app)

        # 站台專屬 models（有才匯入）。這一步必須在 SQLAlchemy 初始化之後，
        # 否則 model 不會註冊進 metadata。
        try:
            import_module(f'{site_package}.models')
        except ModuleNotFoundError:
            pass  # 沒有站台專屬 model，正常情況

        if enable_media_lib:
            from core.backend_engine.factory import db
            from packages.media_lib import register_media_lib
            register_media_lib(app, db)

        if after_init:
            after_init(app)

        app.logger.info(f"Site '{app.config.get('SITE_NAME')}' initialized successfully")

    return create_app(
        config_class=_select_config(config_registry),
        site_extensions=list(extensions),
        skip_blueprints=list(skip_blueprints or []),
        before_init_hooks=[_before],
        after_init_hooks=[_after],
    )


def run_dev_server(app: Flask, site_name: str) -> None:
    """開發伺服器（`python app.py` 時用）。"""
    host = os.environ.get('FLASK_HOST', '0.0.0.0')
    port = int(os.environ.get('FLASK_PORT', 5000))
    debug = app.config.get('DEBUG', False)

    print(f"""
    ╔══════════════════════════════════════════════════════════════╗
    ║  {site_name} Backend
    ╠══════════════════════════════════════════════════════════════╣
    ║  Running at: http://{host}:{port}
    ║  Debug mode: {debug}
    ║  Config: {os.environ.get('FLASK_CONFIG', 'development')}
    ╚══════════════════════════════════════════════════════════════╝
    """)
    app.run(host=host, port=port, debug=debug)
