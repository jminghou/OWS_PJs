'use client';

import { useState } from 'react';
import type { HeroIntro, HeroIntroFields } from '@ows/platform-api/types';
import { AdminImagePicker } from '@ows/ui/admin';
import MediaBrowser from './MediaBrowser';
import { getImageUrl } from '../config';

const FIELDS: { key: keyof HeroIntroFields; label: string; hint: string; rows?: number; max: number }[] = [
  { key: 'eyebrow', label: '小標（選填）', hint: '大標上方的一行小字，例如品牌名或定位', max: 200 },
  { key: 'headline', label: '大標', hint: '一句話說清楚：你們是誰、幫誰、解決什麼', max: 200 },
  { key: 'body', label: '內文', hint: '兩三句即可。空一行會分段', rows: 6, max: 2000 },
  { key: 'newsletter_note', label: '訂閱表單上方說明（選填）', hint: '訂閱後會收到什麼、多久一封', rows: 2, max: 300 },
  { key: 'proof_line', label: '信任佐證（選填）', hint: '一行真實數字或事實；留空就不顯示', max: 300 },
];

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none';

interface Props {
  value: HeroIntro;
  onChange: (value: HeroIntro) => void;
  languages: string[];
  languageNames: Record<string, string>;
  /** 站台的靜態預設文案：欄位留空時前台會顯示它，這裡當 placeholder 提示 */
  defaults?: HeroIntro['locales'];
}

export default function HomepageHeroIntro({ value, onChange, languages, languageNames, defaults }: Props) {
  const tabs = languages.length > 0 ? languages : ['zh-TW'];
  const [active, setActive] = useState(tabs[0]);
  const [browsing, setBrowsing] = useState(false);
  const current = tabs.includes(active) ? active : tabs[0];

  const setField = (key: keyof HeroIntroFields, text: string) =>
    onChange({ ...value, locales: { ...value.locales, [current]: { ...value.locales[current], [key]: text } } });

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        欄位留空時，前台會顯示站台內建的預設文案（灰色提示字）。圖片為各語系共用，可不放。
      </p>

      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => setActive(lang)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              current === lang ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {languageNames[lang] || lang}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {FIELDS.map(({ key, label, hint, rows, max }) => {
          const text = value.locales[current]?.[key] || '';
          const id = `hero-intro-${current}-${key}`;
          const shared = {
            id,
            value: text,
            maxLength: max,
            placeholder: defaults?.[current]?.[key] || '',
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setField(key, e.target.value),
            className: inputCls,
          };
          return (
            <div key={key}>
              <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              {rows ? <textarea {...shared} rows={rows} /> : <input type="text" {...shared} />}
              <p className="mt-1 text-xs text-gray-500">{hint}（{text.length}/{max}）</p>
            </div>
          );
        })}
      </div>

      <AdminImagePicker
        label="圖片（選填，各語系共用）"
        value={value.image_url}
        onRemove={() => onChange({ ...value, image_url: '' })}
        onBrowse={() => setBrowsing(true)}
        getImageUrl={getImageUrl}
        aspectRatio="1/1"
      />

      <MediaBrowser
        isOpen={browsing}
        onClose={() => setBrowsing(false)}
        onSelect={(media) => {
          onChange({ ...value, image_url: media.file_path });
          setBrowsing(false);
        }}
      />
    </div>
  );
}
