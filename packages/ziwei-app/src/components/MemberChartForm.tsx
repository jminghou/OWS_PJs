'use client';

import { useState } from 'react';
import Button from '@ows/ui/ui/Button';
import {
  astrologyApi,
  type TimeType,
  type ZiweiCalcResponse,
  type SaveMyChartRequest,
} from '../api/astrology';
import BirthPlaceFields, { EMPTY_BIRTH_PLACE, toZiweiPlace, type BirthPlace } from './BirthPlaceFields';

/**
 * 會員中心排盤表單：完整生辰欄位 + 「關係」「資料評級」。
 * 計算成功後把結果與可儲存的 payload 交給上層（會員中心）呈現與歸檔；
 * 本身不負責儲存（儲存按鈕在會員中心的命盤檢視區）。
 */

const RELATION_OPTIONS: { value: string; label: string }[] = [
  { value: 'self', label: '我自己' },
  { value: 'father', label: '父親' },
  { value: 'mother', label: '母親' },
  { value: 'son', label: '兒子' },
  { value: 'daughter', label: '女兒' },
  { value: 'brother', label: '兄弟' },
  { value: 'sister', label: '姊妹' },
  { value: 'spouse', label: '配偶' },
  { value: 'friend', label: '朋友' },
];

// 資料評級採占星資料庫通用的 Rodden rating（寫入 user_profiles.rodden_rating）
const RATING_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '未評級' },
  { value: 'AA', label: 'AA — 出生紀錄／官方文件（最可靠）' },
  { value: 'A', label: 'A — 本人或親屬口述' },
  { value: 'B', label: 'B — 傳記、回憶錄等記載' },
  { value: 'C', label: 'C — 來源不明（謹慎使用）' },
  { value: 'DD', label: 'DD — 來源相互矛盾' },
  { value: 'X', label: 'X — 僅知日期（時辰不明）' },
  { value: 'XX', label: 'XX — 日期不確定' },
];

interface Props {
  onComputed: (res: ZiweiCalcResponse, payload: SaveMyChartRequest) => void;
}

export default function MemberChartForm({ onComputed }: Props) {
  const [form, setForm] = useState({
    name: '',
    gender: '男',
    relation: 'self',
    rating: '',
    date: '',
    time: '',
    timeType: 'clock_time' as TimeType,
    place: EMPTY_BIRTH_PLACE as BirthPlace,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (patch: Partial<typeof form>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.date || !form.time) {
      setError('請填寫出生日期與時間');
      return;
    }
    if (form.timeType === 'solar_time' && (!form.place.city || !form.place.country)) {
      setError('真太陽時需選擇出生地點（國家與城市）');
      return;
    }
    const [year, month, day] = form.date.split('-').map(Number);
    const [hour, minute] = form.time.split(':').map(Number);
    const place =
      form.timeType === 'solar_time' ? `${form.place.city}, ${form.place.country}` : '';

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
            ? toZiweiPlace(form.place)
            : undefined,
        // 排盤在瀏覽器算（@ows/ziwei-engine）；靜態 SVG 由後端出，只在會員頁下載時才取
        render: false,
        include_chart_json: true,
        include_flow: true,
      });
      onComputed(res, {
        year,
        month,
        day,
        hour,
        minute: minute || 0,
        gender: form.gender,
        name: form.name,
        place,
        relation: form.relation,
        rating: form.rating,
        time_type: form.timeType,
        birth_place: form.timeType === 'solar_time' ? toZiweiPlace(form.place) : undefined,
      });
    } catch (err: any) {
      setError(err.message || '排盤失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full px-4 py-3 border border-gray-300 rounded-banner focus:ring-2 focus:ring-brand-purple-500 focus:border-transparent';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-2';

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-banner border border-warm-200/70 p-5 sm:p-6 space-y-5"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="mc-name" className={labelCls}>
            姓名（選填）
          </label>
          <input
            id="mc-name"
            type="text"
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            className={inputCls}
            placeholder="例如：小明"
          />
        </div>
        <div>
          <label htmlFor="mc-gender" className={labelCls}>
            性別 *
          </label>
          <select
            id="mc-gender"
            value={form.gender}
            onChange={(e) => set({ gender: e.target.value })}
            className={inputCls}
          >
            <option value="男">男</option>
            <option value="女">女</option>
          </select>
        </div>
        <div>
          <label htmlFor="mc-relation" className={labelCls}>
            關係（命主與你的關係）
          </label>
          <select
            id="mc-relation"
            value={form.relation}
            onChange={(e) => set({ relation: e.target.value })}
            className={inputCls}
          >
            {RELATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="mc-rating" className={labelCls}>
            資料評級（生辰資料可信度）
          </label>
          <select
            id="mc-rating"
            value={form.rating}
            onChange={(e) => set({ rating: e.target.value })}
            className={inputCls}
          >
            {RATING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="mc-date" className={labelCls}>
            出生日期 *
          </label>
          <input
            id="mc-date"
            type="date"
            required
            value={form.date}
            onChange={(e) => set({ date: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="mc-time" className={labelCls}>
            出生時間 *
          </label>
          <input
            id="mc-time"
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
              name="mc-timeType"
              checked={form.timeType === 'clock_time'}
              onChange={() => set({ timeType: 'clock_time' })}
            />
            <span>鐘錶時間（標準時鐘）</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="mc-timeType"
              checked={form.timeType === 'solar_time'}
              onChange={() => set({ timeType: 'solar_time' })}
            />
            <span>真太陽時（依出生地校正，更傳統）</span>
          </label>
        </div>
      </div>

      {/* 出生地點（真太陽時才需要）：與公開排盤同一個元件，含全球城市搜尋 */}
      {form.timeType === 'solar_time' && (
        <BirthPlaceFields value={form.place} onChange={(place) => set({ place })} />
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
        {loading ? '排盤中…' : '排盤'}
      </Button>
    </form>
  );
}
