'use client';

import { useEffect, useRef, useState } from 'react';
import Button from '@ows/ui/ui/Button';
import ZiweiChartResult, { type ZiweiChartPayload } from './ZiweiChartResult';
import { astrologyApi, type TimeType, type ZiweiCalcResponse } from '../api/astrology';
import BirthPlaceFields from './BirthPlaceFields';

/**
 * 紫微斗數排盤「區塊模板」：出生時辰表單 + 命盤結果。
 * 不含外層容器與標題，供 /ziwei 頁與首頁區塊共用。
 *
 * 基本原則：公開頁排完盤「直接顯示互動命盤」（本命層），讓訪客立刻
 * 體驗產品價值；進階功能（儲存歸檔、流盤大限／流年、版型切換、
 * 下載 SVG/PNG）仍保留在會員專區 /account。
 * 結果區與會員 CTA 在 ZiweiChartResult（首頁的滾輪排盤共用同一份）。
 */
export default function ZiweiChartForm() {
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ZiweiCalcResponse | null>(null);
  // 排出目前這張盤時送出的資料（之後表單再被改動，CTA 存的仍是畫面上這張盤）
  const [submitted, setSubmitted] = useState<ZiweiChartPayload | null>(null);
  // 排盤完成後自動捲動到結果區
  const resultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [result]);

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
      setSubmitted(chartPayload());
      setResult(res);
    } catch (err: any) {
      setError(err.message || '排盤失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 目前表單對應的命盤 payload（CTA 暫存／存盤共用）
  const chartPayload = (): ZiweiChartPayload => {
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

  const inputCls =
    'w-full px-4 py-3 border border-gray-300 rounded-banner focus:ring-2 focus:ring-brand-purple-500 focus:border-transparent';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-2';

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

        {/* 出生地點（真太陽時才需要；地點清單在掛載時才載入）*/}
        {form.timeType === 'solar_time' && (
          <BirthPlaceFields
            value={{ continent: form.continent, country: form.country, city: form.city }}
            onChange={(place) => set(place)}
          />
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
      {result && submitted && (
        <div className="mt-10">
          <ZiweiChartResult ref={resultRef} result={result} payload={submitted} />
        </div>
      )}
    </>
  );
}
