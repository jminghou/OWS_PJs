'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ZiweiChart, NAMED_THEMES } from '@ows/ziwei-chart';
import { useAuthStore } from '@/store/auth';
import { astrologyApi } from '@/lib/api';
import type {
  MyPerson,
  MyChart,
  MyFavorite,
  ZiweiCalcResponse,
} from '@/lib/api/astrology';
import Button from '@/components/ui/Button';

const RELATION_LABELS: Record<string, string> = {
  self: '我自己',
  father: '父親',
  mother: '母親',
  son: '兒子',
  daughter: '女兒',
  brother: '兄弟',
  sister: '姊妹',
  spouse: '配偶',
  friend: '朋友',
};
const relLabel = (r?: string | null) => (r ? RELATION_LABELS[r] || r : '');
const birthText = (c: MyChart) =>
  c.birth
    ? `${c.birth.year}/${c.birth.month}/${c.birth.day} ${String(c.birth.hour).padStart(2, '0')}:${String(c.birth.minute).padStart(2, '0')}`
    : c.clock_time || '';

export default function AccountPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, checkAuth, logout } = useAuthStore();

  const [tab, setTab] = useState<'charts' | 'favorites'>('charts');
  const [people, setPeople] = useState<MyPerson[]>([]);
  const [favorites, setFavorites] = useState<MyFavorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [viewing, setViewing] = useState<ZiweiCalcResponse | null>(null);
  const [viewBusy, setViewBusy] = useState(false);

  // 守衛：未登入 → 導向登入頁
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isLoading, isAuthenticated, router]);

  // 載入資料
  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const [c, f] = await Promise.all([
          astrologyApi.myCharts(),
          astrologyApi.myFavorites(),
        ]);
        setPeople(c.people || []);
        setFavorites(f.favorites || []);
      } catch (e: any) {
        setErr(e.message || '載入失敗');
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthenticated]);

  const viewChart = async (c: MyChart) => {
    if (!c.birth) {
      setErr('此命盤缺少生辰資料，無法重繪');
      return;
    }
    setViewBusy(true);
    setErr('');
    try {
      const res = await astrologyApi.calculate({
        year: c.birth.year,
        month: c.birth.month,
        day: c.birth.day,
        hour: c.birth.hour,
        minute: c.birth.minute,
        gender: c.gender || '男',
        name: c.name || '',
        render: false,
        include_chart_json: true,
        include_flow: true,
      });
      setViewing(res);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setErr(e.message || '重繪失敗');
    } finally {
      setViewBusy(false);
    }
  };

  const unfavorite = async (chartId: string) => {
    try {
      await astrologyApi.removeFavorite(chartId);
      setFavorites((prev) => prev.filter((f) => f.chart_id !== chartId));
    } catch (e: any) {
      setErr(e.message || '取消收藏失敗');
    }
  };

  if (isLoading || !isAuthenticated) {
    return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-500">載入中…</div>;
  }

  const tabCls = (active: boolean) =>
    `px-5 py-2 text-sm rounded-banner transition-colors ${
      active
        ? 'bg-brand-purple-600 text-white'
        : 'text-brand-purple-700 hover:bg-brand-purple-50 border border-brand-purple-600'
    }`;
  const cardCls =
    'bg-white rounded-banner border border-warm-200/70 p-4 flex flex-wrap items-center justify-between gap-3';

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">會員中心</h1>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>{user?.email || user?.username}</span>
          <button onClick={() => logout().then(() => router.push('/login'))} className="text-brand-purple-700 hover:underline">
            登出
          </button>
        </div>
      </div>

      {/* 重繪的命盤 */}
      {viewing?.chart_json && (
        <div className="mb-8 bg-white rounded-banner border border-warm-200/70 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 text-sm text-gray-600">
            <span>命盤 ID：<span className="font-mono">{viewing.chart_id}</span></span>
            <button onClick={() => setViewing(null)} className="text-gray-400 hover:text-gray-700">關閉 ✕</button>
          </div>
          <ZiweiChart chart={viewing.chart_json} flow={viewing.flow ?? undefined} theme={NAMED_THEMES.light} />
        </div>
      )}

      <div className="flex gap-3 mb-5">
        <button className={tabCls(tab === 'charts')} onClick={() => setTab('charts')}>
          我的命盤
        </button>
        <button className={tabCls(tab === 'favorites')} onClick={() => setTab('favorites')}>
          我的收藏
        </button>
      </div>

      {err && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-banner text-red-700 text-sm">{err}</div>
      )}
      {viewBusy && <p className="mb-4 text-sm text-gray-500">重繪命盤中…</p>}

      {loading ? (
        <p className="text-gray-500">載入中…</p>
      ) : tab === 'charts' ? (
        people.length === 0 ? (
          <p className="text-gray-500">
            還沒有命盤。到排盤頁排一張並「儲存命盤」即可出現在這裡。
          </p>
        ) : (
          <div className="space-y-6">
            {people.map((p) => (
              <div key={p.user_id}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-gray-800">{p.display_name || '（未命名）'}</span>
                  {p.relation_label && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-brand-purple-100 text-brand-purple-700">
                      {relLabel(p.relation_label)}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {p.charts.map((c) => (
                    <div key={c.chart_id} className={cardCls}>
                      <div className="text-sm text-gray-600">
                        <span className="font-mono text-xs text-gray-400 mr-2">#{c.chart_id.slice(-6)}</span>
                        {c.gender === 'F' || c.gender === '女' ? '女' : '男'}　{birthText(c)}
                      </div>
                      <Button
                        type="button"
                        onClick={() => viewChart(c)}
                        className="bg-brand-purple-600 hover:bg-brand-purple-700 text-sm py-2"
                      >
                        檢視命盤
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : favorites.length === 0 ? (
        <p className="text-gray-500">尚無收藏的命盤。</p>
      ) : (
        <div className="space-y-2">
          {favorites.map((f) => (
            <div key={f.chart_id} className={cardCls}>
              <div className="text-sm text-gray-600">
                <span className="font-medium text-gray-800 mr-2">{f.name || '（未命名）'}</span>
                {f.gender === 'F' || f.gender === '女' ? '女' : '男'}　{birthText(f)}
                {f.note && <span className="ml-2 text-gray-400">— {f.note}</span>}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => viewChart(f)}
                  className="bg-brand-purple-600 hover:bg-brand-purple-700 text-sm py-2"
                >
                  檢視
                </Button>
                <button
                  type="button"
                  onClick={() => unfavorite(f.chart_id)}
                  className="px-3 py-2 text-sm rounded-banner border border-gray-300 text-gray-500 hover:bg-gray-50"
                >
                  取消收藏
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
