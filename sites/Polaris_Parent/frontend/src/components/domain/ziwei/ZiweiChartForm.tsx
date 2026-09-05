'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ZiweiChart, NAMED_THEMES } from '@ows/ziwei-chart';
import Button from '@/components/platform/ui/Button';
import { useAuthStore } from '@/store/auth';
import { stashPendingChart } from '@/lib/pendingChart';
import {
  astrologyApi,
  type GeoHierarchy,
  type TimeType,
  type ZiweiCalcResponse,
} from '@/lib/api';

/**
 * 紫微斗數排盤「區塊模板」：出生時辰表單 + 命盤結果。
 * 不含外層容器與標題，供 /ziwei 頁與首頁區塊共用。
 *
 * 基本原則：公開頁排完盤「直接顯示互動命盤」（本命層），讓訪客立刻
 * 體驗產品價值；進階功能（儲存歸檔、流盤大限／流年、版型切換、
 * 下載 SVG/PNG）仍保留在會員專區 /account。
 * - 未登入：CTA「加入會員，儲存這張命盤」→ 暫存命盤並前往
 *   /login?mode=register，註冊／登入成功後命盤自動存入帳號並直開詳情頁。
 * - 已登入：CTA「儲存並開啟進階命盤」→ 直接把剛排的盤存進帳號
 *   （後端有去重，重複儲存回既有盤），再導向該命盤詳情頁。
 */
export default function ZiweiChartForm() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [form, setForm] = useState({
    name: '',
    gender: '男',
    date: '',
    time: '',
    timeType: 'clock_time' as TimeType,
    continent: '',
    country: '',
    city: '',
  });

  const [geo, setGeo] = useState<GeoHierarchy | null>(null);
  const [geoError, setGeoError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ZiweiCalcResponse | null>(null);
  // 會員 CTA（儲存並開啟進階命盤）的進行中／錯誤狀態
  const [ctaBusy, setCtaBusy] = useState(false);
  const [ctaError, setCtaError] = useState('');
  // 排盤完成後自動捲動到結果區
  const resultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [result]);

  // 切到「真太陽時」時才載入地點選項
  useEffect(() => {
    if (form.timeType !== 'solar_time' || geo) return;
    astrologyApi
      .geoOptions()
      .then(setGeo)
      .catch((e) => setGeoError(e.message || '無法載入地點'));
  }, [form.timeType, geo]);

  const countries = useMemo(
    () => (geo && form.continent ? Object.keys(geo[form.continent] || {}) : []),
    [geo, form.continent]
  );
  const cities = useMemo(
    () =>
      geo && form.continent && form.country
        ? geo[form.continent]?.[form.country] || []
        : [],
    [geo, form.continent, form.country]
  );

  const set = (patch: Partial<typeof form>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!form.date || !form.time) {
      setError('請填寫出生日期與時間');
      return;
    }
    const [year, month, day] = form.date.split('-').map(Number);
    const [hour, minute] = form.time.split(':').map(Number);

    if (form.timeType === 'solar_time' && (!form.city || !form.country)) {
      setError('真太陽時需選擇出生地點（國家與城市）');
      return;
    }

    setLoading(true);
    try {
      const res = await astrologyApi.calculate({
        year,
        month,
        day,
        hour,
        minute: minute || 0,
        gender: form.gender,
        name: form.name,
        time_type: form.timeType,
        place:
          form.timeType === 'solar_time'
            ? { city: form.city, country: form.country }
            : undefined,
        // 公開頁直接呈現互動命盤（本命層）；靜態 SVG 僅作渲染失敗時的備援。
        // 流盤（大限／流年）屬會員專區進階功能，公開頁不請求。
        render: true,
        include_chart_json: true,
        include_flow: false,
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || '排盤失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 目前表單對應的命盤 payload（CTA 暫存／存盤共用）
  const chartPayload = () => {
    const [year, month, day] = form.date.split('-').map(Number);
    const [hour, minute] = form.time.split(':').map(Number);
    return {
      year,
      month,
      day,
      hour,
      minute: minute || 0,
      gender: form.gender,
      name: form.name,
      place:
        form.timeType === 'solar_time' ? `${form.city}, ${form.country}` : '',
      relation: 'self',
    };
  };

  // ── 訪客 CTA：暫存剛排的命盤 → 前往登入／註冊合一頁 ──
  const goJoin = () => {
    stashPendingChart(chartPayload());
    router.push('/login?mode=register');
  };

  // ── 會員 CTA：直接把剛排的盤存進帳號（後端去重），再開該命盤詳情頁 ──
  const goAdvanced = async () => {
    setCtaBusy(true);
    setCtaError('');
    try {
      const res = await astrologyApi.saveMyChart(chartPayload());
      router.push(`/account/charts/${res.chart_id}`);
    } catch (err: any) {
      if (err?.status === 401) {
        // 登入狀態已過期（本地狀態過時）→ 退回訪客流程：暫存後前往登入
        stashPendingChart(chartPayload());
        router.push('/login');
        return;
      }
      setCtaError(err.message || '儲存失敗，請稍後再試');
      setCtaBusy(false);
    }
    // 成功導頁時不重設 busy，避免按鈕在跳轉前閃回可按狀態
  };

  const inputCls =
    'w-full px-4 py-3 border border-gray-300 rounded-banner focus:ring-2 focus:ring-brand-purple-500 focus:border-transparent';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-2';

  const mingGong = result?.data?.['宮位資料']?.['命宮'];

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-banner border border-warm-200/70 shadow-[0_8px_30px_rgba(139,92,246,0.06)] p-6 sm:p-8 space-y-6"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label htmlFor="name" className={labelCls}>
              姓名（選填）
            </label>
            <input
              id="name"
              type="text"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              className={inputCls}
              placeholder="例如：小明"
            />
          </div>
          <div>
            <label htmlFor="gender" className={labelCls}>
              性別 *
            </label>
            <select
              id="gender"
              value={form.gender}
              onChange={(e) => set({ gender: e.target.value })}
              className={inputCls}
            >
              <option value="男">男</option>
              <option value="女">女</option>
            </select>
          </div>
          <div>
            <label htmlFor="date" className={labelCls}>
              出生日期 *
            </label>
            <input
              id="date"
              type="date"
              required
              value={form.date}
              onChange={(e) => set({ date: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="time" className={labelCls}>
              出生時間 *
            </label>
            <input
              id="time"
              type="time"
              required
              value={form.time}
              onChange={(e) => set({ time: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>

        {/* 時間制 */}
        <div>
          <span className={labelCls}>時間制</span>
          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="timeType"
                checked={form.timeType === 'clock_time'}
                onChange={() => set({ timeType: 'clock_time' })}
              />
              <span>鐘錶時間（標準時鐘）</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="timeType"
                checked={form.timeType === 'solar_time'}
                onChange={() => set({ timeType: 'solar_time' })}
              />
              <span>真太陽時（依出生地校正，更傳統）</span>
            </label>
          </div>
        </div>

        {/* 出生地點（真太陽時才需要）*/}
        {form.timeType === 'solar_time' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-warm-50 rounded-banner">
            {geoError && (
              <p className="sm:col-span-3 text-sm text-red-600">{geoError}</p>
            )}
            <div>
              <label className={labelCls}>洲 *</label>
              <select
                value={form.continent}
                onChange={(e) =>
                  set({ continent: e.target.value, country: '', city: '' })
                }
                className={inputCls}
                disabled={!geo}
              >
                <option value="">請選擇</option>
                {geo &&
                  Object.keys(geo).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>國家 *</label>
              <select
                value={form.country}
                onChange={(e) => set({ country: e.target.value, city: '' })}
                className={inputCls}
                disabled={!form.continent}
              >
                <option value="">請選擇</option>
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>城市 *</label>
              <select
                value={form.city}
                onChange={(e) => set({ city: e.target.value })}
                className={inputCls}
                disabled={!form.country}
              >
                <option value="">請選擇</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-banner text-red-700 text-sm">
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-purple-600 hover:bg-brand-purple-700"
        >
          {loading ? '排盤中…' : '開始排盤'}
        </Button>
      </form>

      {/* 結果 */}
      {result && (
        <div
          ref={resultRef}
          className="mt-10 scroll-mt-20 bg-white rounded-banner border border-warm-200/70 shadow-[0_8px_30px_rgba(139,92,246,0.06)] p-4 sm:p-6"
        >
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 mb-4 text-sm text-gray-600">
            <span>
              命盤 ID：<span className="font-mono">{result.chart_id}</span>
            </span>
            {mingGong && (
              <span>
                命宮：{mingGong['宮位']}（{mingGong['干支']}）
              </span>
            )}
            {result.solar_time && <span>真太陽時：{result.solar_time}</span>}
          </div>

          {/* 互動命盤（本命層）；chart_json 缺失時退回靜態 SVG */}
          {result.chart_json ? (
            <ZiweiChart chart={result.chart_json} theme={NAMED_THEMES.light} />
          ) : result.svg ? (
            <div
              className="w-full overflow-x-auto flex justify-center [&>svg]:max-w-full [&>svg]:h-auto"
              // SVG 由自家後端 p_e_artist 產生（可信來源）
              dangerouslySetInnerHTML={{ __html: result.svg }}
            />
          ) : (
            <p className="text-sm text-amber-600">
              命盤資料已產生，但圖檔渲染失敗。
            </p>
          )}

          {/* 唯一的按鈕：依登入狀態決定 CTA */}
          <div className="mt-6 text-center">
            {ctaError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-banner text-red-700 text-sm">
                {ctaError}
              </div>
            )}
            {isAuthenticated ? (
              <>
                <Button
                  type="button"
                  onClick={goAdvanced}
                  disabled={ctaBusy}
                  className="bg-brand-purple-600 hover:bg-brand-purple-700"
                >
                  {ctaBusy ? '儲存中…' : '儲存並開啟進階命盤'}
                </Button>
                <p className="mt-3 text-xs text-gray-400">
                  會把這張命盤存進你的帳號（重複儲存不會建立新盤），並開啟大限／流年、版型切換與下載等進階功能。
                </p>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  onClick={goJoin}
                  className="bg-brand-purple-600 hover:bg-brand-purple-700"
                >
                  加入會員，儲存這張命盤
                </Button>
                <p className="mt-3 text-xs text-gray-400">
                  註冊後會自動把這張命盤存進帳號，並解鎖大限／流年、版型切換與下載等進階功能。
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
