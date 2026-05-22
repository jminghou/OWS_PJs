"""
瀏覽計數（與讀取路徑解耦）。

問題：原本每次讀文章都 `db.session.commit()` 寫一次 views_count，等於把「讀」變成「讀+寫」，
在慢/冷啟動的後端尤其拖累，且讓回應無法快取。

做法：讀取時只對 Redis 做 HINCRBY（次毫秒、best-effort，失敗也絕不影響回應）；
再由 CLI `flush-views`（可掛 cron）把累積量寫回 DB。顯示的 views_count 會延遲到下次 flush，
對部落格而言完全可接受。
"""

import logging

from flask import current_app

logger = logging.getLogger(__name__)

_PENDING_KEY = 'pending_views'  # Redis hash：{content_id: 累積瀏覽數}
_client = None


def _redis():
    """取得（並快取）Redis client；無 REDIS_URL 或連不上時回 None。"""
    global _client
    if _client is not None:
        return _client
    try:
        import redis  # flask-caching 的 RedisCache 已帶此依賴
        url = current_app.config.get('REDIS_URL')
        if not url:
            return None
        _client = redis.from_url(url, decode_responses=True)
        return _client
    except Exception as e:  # 連線/匯入失敗都不該影響讀取
        logger.warning(f'view_counter: redis unavailable: {e}')
        return None


def record_view(content_id):
    """Best-effort：把一次瀏覽記到 Redis。任何例外都吞掉，不拖慢、不弄壞文章讀取。"""
    try:
        client = _redis()
        if client is not None:
            client.hincrby(_PENDING_KEY, int(content_id), 1)
    except Exception:
        pass


def flush_views(db):
    """把 Redis 累積的瀏覽數寫回 DB。回傳 (更新筆數, 總增量)。"""
    from core.backend_engine.models import Content

    client = _redis()
    if client is None:
        return (0, 0)

    pending = client.hgetall(_PENDING_KEY)
    if not pending:
        return (0, 0)

    updated = 0
    total = 0
    for raw_id, raw_cnt in pending.items():
        try:
            content_id = int(raw_id)
            count = int(raw_cnt)
        except (TypeError, ValueError):
            continue
        if count <= 0:
            continue
        Content.query.filter_by(id=content_id).update(
            {Content.views_count: Content.views_count + count},
            synchronize_session=False,
        )
        # 用負值扣回已寫入的量（而非 hdel），保留 flush 期間新進來的計數
        client.hincrby(_PENDING_KEY, raw_id, -count)
        updated += 1
        total += count

    db.session.commit()
    return (updated, total)
