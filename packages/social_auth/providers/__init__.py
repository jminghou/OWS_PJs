"""社群登入 provider。新增 provider 時在這裡登記，資料表不用改。"""
from packages.social_auth.providers.base import ProviderError, ProviderProfile
from packages.social_auth.providers import google, line

PROVIDERS = {
    'google': google,
    'line': line,
}


def enabled_providers():
    """目前設定完整、可以顯示給前端的 provider 與其公開資訊。"""
    return {name: mod.public_config() for name, mod in PROVIDERS.items() if mod.is_configured()}


__all__ = ['PROVIDERS', 'ProviderError', 'ProviderProfile', 'enabled_providers']
