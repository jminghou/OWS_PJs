'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ZiweiChart, NAMED_THEMES } from '@ows/ziwei-chart';
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
 * 權限分流：
 * - 未登入瀏覽者：只看得到靜態圖，唯一的按鈕是「加入會員」CTA，
 *   按下後暫存命盤並前往 /login?mode=register（登入／註冊合一頁），
 *   註冊或登入成功後命盤自動存入帳號。
 * - 已登入會員：完整功能（互動命盤、版型切換、下載 SVG/PNG）。
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
  const [pngBusy, setPngBusy] = useState(false);
  const [viewMode, setViewMode] = useState<'interactive' | 'static'>('interactive');
  const [chartTheme, setChartTheme] = useState<'light' | 'dark' | 'sepia'>('light');

  // 一鍵建檔 + 註冊（第三期）
  const [saveEmail, setSaveEmail] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveDone, setSaveDone] = useState('');
  const [saveErr, setSaveErr] = useState('');

  // 已登入會員：建檔 email 預填會員信箱
  useEffect(() => {
    if (isAuthenticated && user?.email) setSaveEmail(user.email);
  }, [isAuthenticated, user?.email]);

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
        // 互動命盤資料只給會員：未登入者僅取靜態 SVG
        include_chart_json: isAuthenticated,
        include_flow: isAuthenticated,
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || '排盤失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // ── 一鍵建檔 + 註冊：存命盤、建免密碼會員、寄設定密碼信 ──
  const handleSave = async () => {
    setSaveErr('');
    setSaveDone('');
    if (!saveEmail || !saveEmail.includes('@')) {
      setSaveErr('請輸入有效的 email');
      return;
    }
    const [year, month, day] = form.date.split('-').map(Number);
    const [hour, minute] = form.time.split(':').map(Number);
    setSaveBusy(true);
    try {
      const res = await astrologyApi.saveAndRegister({
        year,
        month,
        day,
        hour,
        minute: minute || 0,
        gender: form.gender,
        name: form.name,
        place:
          form.timeType === 'solar_time'
            ? `${form.city}, ${form.country}`
            : '',
        email: saveEmail,
        relation: 'self',
      });
      setSaveDone(
        res.is_new_member
          ? '已儲存命盤並建立會員！設定密碼信已寄出，請至 email 設定密碼即可登入查看。'
          : '已儲存命盤到你的會員帳號！'
      );
    } catch (err: any) {
      setSaveErr(err.message || '儲存失敗，請稍後再試');
    } finally {
      setSaveBusy(false);
    }
  };

  // ── 訪客 CTA：暫存剛排的命盤 → 前往登入／註冊合一頁 ──
  const goJoin = () => {
    const [year, month, day] = form.date.split('-').map(Number);
    const [hour, minute] = form.time.split(':').map(Number);
    stashPendingChart({
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
    });
    router.push('/login?mode=register');
  };

  // ── 下載（全部在前端，零伺服器成本）──
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fileBase = () => {
    const nm = form.name?.trim();
    return `ziwei_${nm ? nm + '_' : ''}${result?.chart_id || 'chart'}`;
  };

  // 直接把已載入的 SVG 字串存成 .svg（不打伺服器）
  const downloadSvg = () => {
    if (!result?.svg) return;
    downloadBlob(
      new Blob([result.svg], { type: 'image/svg+xml;charset=utf-8' }),
      `${fileBase()}.svg`
    );
  };

  // 用 canvas 把 SVG 點陣化成 PNG（2x 清晰度），全在瀏覽器完成
  const downloadPng = async (scale = 2) => {
    if (!result?.svg) return;
    setPngBusy(true);
    try {
      const svg = result.svg;
      const m =
        svg.match(/viewBox="0\s+0\s+([\d.]+)\s+([\d.]+)"/) ||
        svg.match(/width="([\d.]+)"[^>]*height="([\d.]+)"/);
      const w = m ? parseFloat(m[1]) : 800;
      const h = m ? parseFloat(m[2]) : 800;

      const svgUrl = URL.createObjectURL(
        new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
      );
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('SVG 載入失敗'));
        img.src = svgUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('無法建立繪圖環境');
      ctx.fillStyle = '#ffffff'; // 白底，避免透明背景
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(svgUrl);

      await new Promise<void>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) downloadBlob(blob, `${fileBase()}.png`);
          resolve();
        }, 'image/png');
      });
    } catch (e: any) {
      setError(e.message || 'PNG 轉換失敗');
    } finally {
      setPngBusy(false);
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

          {!isAuthenticated ? (
            <>
              {/* 未登入：只給靜態圖，無任何工具列 */}
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

              {/* 唯一的按鈕：加入會員 CTA → 暫存命盤並前往登入／註冊合一頁 */}
              <div className="mt-6 text-center">
                <Button
                  type="button"
                  onClick={goJoin}
                  className="bg-brand-purple-600 hover:bg-brand-purple-700"
                >
                  加入會員，解鎖更多命盤功能
                </Button>
              </div>
            </>
          ) : (
            <>
          {/* 會員：儲存這張命盤到帳號 */}
          <div className="mb-4 p-4 bg-brand-purple-50 rounded-banner border border-brand-purple-200">
            <p className="text-sm font-medium text-gray-700 mb-2">
              儲存這張命盤到你的會員帳號
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={saveEmail}
                onChange={(e) => setSaveEmail(e.target.value)}
                placeholder="你的 email"
                className={`${inputCls} sm:flex-1`}
              />
              <Button
                type="button"
                onClick={handleSave}
                disabled={saveBusy}
                className="bg-brand-purple-600 hover:bg-brand-purple-700 whitespace-nowrap"
              >
                {saveBusy ? '儲存中…' : '儲存命盤'}
              </Button>
            </div>
            {saveErr && <p className="mt-2 text-sm text-red-600">{saveErr}</p>}
            {saveDone && <p className="mt-2 text-sm text-green-700">{saveDone}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            {/* 互動 / 靜態 檢視切換 */}
            {result.chart_json && (
              <div className="inline-flex rounded-banner border border-brand-purple-600 overflow-hidden text-sm">
                <button
                  type="button"
                  onClick={() => setViewMode('interactive')}
                  className={`px-4 py-2 transition-colors ${
                    viewMode === 'interactive'
                      ? 'bg-brand-purple-600 text-white'
                      : 'text-brand-purple-700 hover:bg-brand-purple-50'
                  }`}
                >
                  互動命盤
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('static')}
                  className={`px-4 py-2 transition-colors ${
                    viewMode === 'static'
                      ? 'bg-brand-purple-600 text-white'
                      : 'text-brand-purple-700 hover:bg-brand-purple-50'
                  }`}
                >
                  靜態圖
                </button>
              </div>
            )}

            {/* 版型樣式（互動命盤）*/}
            {result.chart_json && viewMode === 'interactive' && (
              <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                版型
                <select
                  value={chartTheme}
                  onChange={(e) =>
                    setChartTheme(e.target.value as 'light' | 'dark' | 'sepia')
                  }
                  className="px-3 py-2 text-sm rounded-banner border border-gray-300 focus:ring-2 focus:ring-brand-purple-500 focus:border-transparent"
                >
                  <option value="light">淺色</option>
                  <option value="dark">深色</option>
                  <option value="sepia">宣紙</option>
                </select>
              </label>
            )}

            {result.svg && (
              <>
                <button
                  type="button"
                  onClick={downloadSvg}
                  className="px-4 py-2 text-sm rounded-banner border border-brand-purple-600 text-brand-purple-700 hover:bg-brand-purple-50 transition-colors"
                >
                  下載 SVG
                </button>
                <button
                  type="button"
                  onClick={() => downloadPng(2)}
                  disabled={pngBusy}
                  className="px-4 py-2 text-sm rounded-banner border border-brand-purple-600 text-brand-purple-700 hover:bg-brand-purple-50 transition-colors disabled:opacity-50"
                >
                  {pngBusy ? '轉換中…' : '下載 PNG'}
                </button>
              </>
            )}
          </div>

          {result.chart_json && viewMode === 'interactive' ? (
            <div
              className="w-full rounded-banner p-2 sm:p-4"
              style={{
                background: chartTheme === 'light' ? 'transparent' : NAMED_THEMES[chartTheme].colors?.bg,
                transition: 'background 200ms ease',
              }}
            >
              <ZiweiChart
                chart={result.chart_json}
                flow={result.flow ?? undefined}
                theme={NAMED_THEMES[chartTheme]}
              />
            </div>
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
            </>
          )}
        </div>
      )}
    </>
  );
}
