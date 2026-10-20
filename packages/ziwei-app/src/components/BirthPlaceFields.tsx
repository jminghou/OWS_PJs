'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { astrologyApi, type GeoHierarchy, type WorldPlace, type ZiweiPlace } from '../api/astrology';

export interface BirthPlace {
  continent: string;
  country: string;
  city: string;
  /** 全球城市（搜尋選到的）：後端以 geonameid 查，前端預覽用 lat／lon／tz */
  geonameid?: number;
  lat?: number;
  lon?: number;
  tz?: string;
  place_en?: string;
}

export const EMPTY_BIRTH_PLACE: BirthPlace = { continent: '', country: '', city: '' };

/** 送 API／前端引擎用的出生地：常用城市只帶 city＋country；全球城市另帶 geonameid 與座標、時區 */
export function toZiweiPlace(p: BirthPlace): ZiweiPlace {
  const base = { city: p.city, country: p.country };
  return p.geonameid
    ? { ...base, geonameid: p.geonameid, lat: p.lat, lon: p.lon, tz: p.tz, place_en: p.place_en }
    : base;
}

interface BirthPlaceFieldsProps {
  value: BirthPlace;
  onChange: (value: BirthPlace) => void;
  className?: string;
}

// 地點清單整個 session 只抓一次：這個元件只在選了真太陽時才掛載，反覆展開／收合不該重抓
let geoRequest: Promise<GeoHierarchy> | null = null;
const loadGeo = () => {
  geoRequest ??= astrologyApi.geoOptions().catch((error) => {
    geoRequest = null; // 失敗不快取，下次展開再試
    throw error;
  });
  return geoRequest;
};

const selectCls =
  'w-full px-4 py-3 border border-gray-300 rounded-banner bg-white focus:ring-2 focus:ring-brand-purple-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400';
const labelCls = 'block text-sm font-medium text-gray-700 mb-2';
const linkCls = 'min-h-[44px] text-sm text-brand-purple-600 underline-offset-2 hover:underline';

/** 全球城市搜尋（GeoNames 約 3.4 萬城）：常用城市選單找不到時用 */
function WorldPlaceSearch({ onPick, onCancel }: { onPick: (p: WorldPlace) => void; onCancel: () => void }) {
  const id = useId();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<WorldPlace[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setResults([]);
      return;
    }
    const mine = ++seq.current;
    const timer = setTimeout(() => {
      setBusy(true);
      astrologyApi.searchPlaces(query, 10)
        .then((r) => { if (mine === seq.current) { setResults(r.places); setError(''); } })
        .catch((e) => { if (mine === seq.current) setError(e.message || '搜尋失敗'); })
        .finally(() => { if (mine === seq.current) setBusy(false); });
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <div className="sm:col-span-3 space-y-2">
      <label htmlFor={`${id}-q`} className={labelCls}>搜尋出生城市（中文、英文或當地語言）</label>
      <input
        id={`${id}-q`}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="例如：Tromsø、奧斯陸、Gothenburg"
        className={selectCls}
        autoComplete="off"
        autoFocus
      />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {busy && <p className="text-sm text-gray-500">搜尋中…</p>}
      {!busy && q.trim() && results.length === 0 && !error && (
        <p className="text-sm text-gray-500">找不到符合的城市，試試英文名稱或附近的大城市。</p>
      )}
      {results.length > 0 && (
        <ul className="max-h-72 overflow-y-auto rounded-banner border border-gray-200 bg-white" role="listbox" aria-label="搜尋結果">
          {results.map((r) => (
            <li key={r.geonameid}>
              <button type="button" role="option" aria-selected={false} onClick={() => onPick(r)}
                className="flex min-h-[44px] w-full flex-col items-start px-4 py-2 text-left hover:bg-warm-50">
                <span className="text-gray-900">{r.label}</span>
                <span className="text-xs text-gray-500">{[r.detail, r.tz].filter(Boolean).join('・')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onCancel} className={linkCls}>改回從選單選擇</button>
        <span className="text-xs text-gray-500">
          全球城市資料來源：
          <a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer" className="underline">GeoNames</a>
          （<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="underline">CC BY 4.0</a>）
        </span>
      </div>
    </div>
  );
}

/** 出生地點：常用城市（洲 → 國家 → 城市）＋找不到時搜尋全球城市。/ziwei 完整表單、首頁快速排盤與報告精靈共用。 */
export default function BirthPlaceFields({ value, onChange, className = '' }: BirthPlaceFieldsProps) {
  const id = useId();
  const [geo, setGeo] = useState<GeoHierarchy | null>(null);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let active = true;
    loadGeo()
      .then((data) => active && setGeo(data))
      .catch((e) => active && setError(e.message || '無法載入地點'));
    return () => {
      active = false;
    };
  }, []);

  const wrapCls = `grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-warm-50 rounded-banner ${className}`;

  if (value.geonameid) {
    return (
      <div className={wrapCls}>
        <div className="sm:col-span-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className={labelCls.replace(' mb-2', '')}>出生地 *</p>
            <p className="text-gray-900">{value.city}, {value.country}</p>
            <p className="text-xs text-gray-500">{[value.place_en !== value.city ? value.place_en : '', value.tz].filter(Boolean).join('・')}</p>
          </div>
          <button type="button" className={linkCls} onClick={() => { onChange(EMPTY_BIRTH_PLACE); setSearching(true); }}>
            重新選擇
          </button>
        </div>
      </div>
    );
  }

  if (searching) {
    return (
      <div className={wrapCls}>
        <WorldPlaceSearch
          onCancel={() => setSearching(false)}
          onPick={(r) => {
            setSearching(false);
            onChange({ continent: '', country: r.country, city: r.name_zh || r.name, geonameid: r.geonameid,
                       lat: r.lat, lon: r.lon, tz: r.tz, place_en: r.name });
          }}
        />
      </div>
    );
  }

  const countries = geo && value.continent ? Object.keys(geo[value.continent] || {}) : [];
  const cities = geo && value.continent && value.country ? geo[value.continent]?.[value.country] || [] : [];

  return (
    <div className={wrapCls}>
      {error && <p role="alert" className="sm:col-span-3 text-sm text-red-600">{error}</p>}
      <div>
        <label htmlFor={`${id}-continent`} className={labelCls}>洲 *</label>
        <select
          id={`${id}-continent`}
          value={value.continent}
          onChange={(e) => onChange({ continent: e.target.value, country: '', city: '' })}
          className={selectCls}
          disabled={!geo}
        >
          <option value="">{geo || error ? '請選擇' : '載入中…'}</option>
          {geo && Object.keys(geo).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-country`} className={labelCls}>國家 *</label>
        <select
          id={`${id}-country`}
          value={value.country}
          onChange={(e) => onChange({ ...value, country: e.target.value, city: '' })}
          className={selectCls}
          disabled={!value.continent}
        >
          <option value="">請選擇</option>
          {countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-city`} className={labelCls}>城市 *</label>
        <select
          id={`${id}-city`}
          value={value.city}
          onChange={(e) => onChange({ ...value, city: e.target.value })}
          className={selectCls}
          disabled={!value.country}
        >
          <option value="">請選擇</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="sm:col-span-3">
        <button type="button" className={linkCls} onClick={() => setSearching(true)}>
          選單裡找不到出生的城市？搜尋全球城市
        </button>
      </div>
    </div>
  );
}
