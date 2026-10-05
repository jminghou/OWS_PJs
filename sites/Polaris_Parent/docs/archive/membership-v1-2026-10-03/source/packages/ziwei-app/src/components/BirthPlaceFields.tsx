'use client';

import { useEffect, useId, useState } from 'react';
import { astrologyApi, type GeoHierarchy } from '../api/astrology';

export interface BirthPlace {
  continent: string;
  country: string;
  city: string;
}

export const EMPTY_BIRTH_PLACE: BirthPlace = { continent: '', country: '', city: '' };

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

/** 真太陽時用的出生地點（洲 → 國家 → 城市）。/ziwei 的完整表單與首頁的快速排盤共用。 */
export default function BirthPlaceFields({ value, onChange, className = '' }: BirthPlaceFieldsProps) {
  const id = useId();
  const [geo, setGeo] = useState<GeoHierarchy | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    loadGeo()
      .then((data) => active && setGeo(data))
      .catch((e) => active && setError(e.message || '無法載入地點'));
    return () => {
      active = false;
    };
  }, []);

  const countries = geo && value.continent ? Object.keys(geo[value.continent] || {}) : [];
  const cities = geo && value.continent && value.country ? geo[value.continent]?.[value.country] || [] : [];

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-warm-50 rounded-banner ${className}`}>
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
    </div>
  );
}
