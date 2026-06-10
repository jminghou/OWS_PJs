'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
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
 * 基本原則：官網公開頁一律只給「最基礎的靜態命盤 + 單一 CTA」，
 * 互動命盤與其他進階功能（版型、下載、流盤切換）全部收在會員專區 /account。
 * - 未登入：CTA「加入會員，解鎖更多命盤功能」→ 暫存命盤並前往
 *   /login?mode=register，註冊／登入成功後命盤自動存入帳號。
 * - 已登入：CTA「使用進階命盤功能」→ 把這張命盤存入帳號後前往會員專區。
 */
export default function ZiweiChartForm() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
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

  // 會員 CTA：存盤後前往會員專區
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveErr, setSaveErr] = useState('');

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
        render: true,
        // 公開頁一律只呈現靜態圖；互動命盤資料只在會員專區請求
        include_chart_json: false,
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

  // ── 會員 CTA：把這張命盤存入帳號 → 前往會員專區 ──
  const goAdvanced = async () => {
    const email = user?.email || user?.username;
    if (!email) {
      router.push('/account');
      return;
    }
    setSaveErr('');
    setSaveBusy(true);
    try {
      await astrologyApi.saveAndRegister({ ...chartPayload(), email });
      router.push('/account');
    } catch (err: any) {
      setSaveErr(err.message || '命盤儲存失敗，請稍後再試');
    } finally {
      setSaveBusy(false);
    }
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
        <div className="mt-10 bg-white rounded-banner border border-warm-200/70 shadow-[0_8px_30px_rgba(139,92,246,0.06)] p-4 sm:p-6">
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

          {/* 公開頁一律只給靜態圖（不分訪客／會員）*/}
          {result.svg ? (
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
            {isAuthenticated ? (
              <>
                <Button
                  type="button"
                  onClick={goAdvanced}
                  disabled={saveBusy}
                  className="bg-brand-purple-600 hover:bg-brand-purple-700"
                >
                  {saveBusy ? '儲存命盤中…' : '使用進階命盤功能'}
                </Button>
                {saveErr && <p className="mt-2 text-sm text-red-600">{saveErr}</p>}
              </>
            ) : (
              <Button
                type="button"
                onClick={goJoin}
                className="bg-brand-purple-600 hover:bg-brand-purple-700"
              >
                加入會員，解鎖更多命盤功能
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
