'use client';

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import Popover from '@ows/ui/ui/Popover';
import { astrologyApi, type ZiweiCalcResponse } from '../api/astrology';
import BirthPlaceFields, { EMPTY_BIRTH_PLACE, type BirthPlace } from './BirthPlaceFields';
import WheelColumn, { type WheelOption } from './WheelColumn';
import ZiweiChartResult, { type ZiweiChartPayload } from './ZiweiChartResult';

const MIN_YEAR = 1900;
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

const pad = (n: number) => String(n).padStart(2, '0');
const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();
// 時辰以奇數整點為界（23–1 子、1–3 丑…），所以只選「幾點」就足以決定時辰，不需要分鐘
const branchOf = (hour: number) => BRANCHES[Math.floor(((hour + 1) % 24) / 2)];

// 一行內的控制項共用高度與字級；手機用較小字級才放得進一行
const CONTROL = 'h-11 whitespace-nowrap rounded-banner text-sm sm:text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-500 focus-visible:ring-offset-1';
// 分段按鈕（性別、時間制）裡的每一格
const SEGMENT = 'rounded-[calc(var(--radius-banner)-4px)] px-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-500 sm:px-4';
const SEGMENT_ON = 'bg-white font-semibold text-gray-900 shadow-sm';
const SEGMENT_OFF = 'text-gray-600 hover:text-gray-900';
const PICKER_BUTTON = `${CONTROL} border border-warm-300 bg-white px-2 tabular-nums text-gray-900 transition-colors hover:border-brand-purple-400 aria-expanded:border-brand-purple-500 aria-expanded:ring-2 aria-expanded:ring-brand-purple-200 sm:px-4`;

/** 按鈕 → 跳出滾輪的小面板（做法同 Ionic 的 datetime-button：按鈕顯示目前的值，按下才出現選擇器）。 */
function PickerButton({ dialogLabel, button, children }: { dialogLabel: string; button: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement="bottom"
      className="!rounded-banner !border-warm-200 p-3"
      trigger={<button type="button" aria-haspopup="dialog" className={PICKER_BUTTON}>{button}</button>}
      content={
        <div aria-label={dialogLabel}>
          {children}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 w-full rounded-banner bg-brand-purple-600 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-500 focus-visible:ring-offset-2"
          >
            完成
          </button>
        </div>
      }
    />
  );
}

/**
 * 首頁用的快速排盤，整組是一張卡片：第一行完成輸入（性別｜出生日期｜出生時間｜立即排盤），
 * 第二行是時間制切換（鐘錶時間｜真太陽時）與目前選定的生日，
 * 送出後命盤直接出現在下方。日期與時間是按鈕，按下才跳出滾輪選擇器，平常不佔版面。
 * 預設用鐘錶時間；切到「真太陽時」會在卡片內展開出生地選單，同一顆按鈕排出的就是真太陽時命盤，不必換頁。
 */
export default function ZiweiQuickChart() {
  const solarPanelId = useId();
  const thisYear = new Date().getFullYear();
  // 預設落在「學齡孩子」附近，家長少滑一點
  const [birth, setBirth] = useState({ year: thisYear - 8, month: 1, day: 1, hour: 8 });
  const [gender, setGender] = useState('男');
  // 切回鐘錶時間時已選的地點保留，再切到真太陽時不必重選
  const [useSolarTime, setUseSolarTime] = useState(false);
  const [place, setPlace] = useState<BirthPlace>(EMPTY_BIRTH_PLACE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ZiweiCalcResponse | null>(null);
  const [submitted, setSubmitted] = useState<ZiweiChartPayload | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const years = useMemo<WheelOption<number>[]>(
    () => Array.from({ length: thisYear - MIN_YEAR + 1 }, (_, i) => ({ value: MIN_YEAR + i, label: `${MIN_YEAR + i} 年` })),
    [thisYear],
  );
  const months = useMemo<WheelOption<number>[]>(
    () => Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1} 月` })),
    [],
  );
  const dayCount = daysInMonth(birth.year, birth.month);
  const days = useMemo<WheelOption<number>[]>(
    () => Array.from({ length: dayCount }, (_, i) => ({ value: i + 1, label: `${i + 1} 日` })),
    [dayCount],
  );
  const hours = useMemo<WheelOption<number>[]>(
    () => Array.from({ length: 24 }, (_, h) => ({ value: h, label: `${pad(h)}:00 ${branchOf(h)}時` })),
    [],
  );
  const day = Math.min(birth.day, dayCount);

  // 換月份／年份後日數變少（例如 31 日 → 2 月）：把日期收進範圍內
  useEffect(() => {
    if (birth.day > dayCount) setBirth((prev) => ({ ...prev, day: dayCount }));
  }, [birth.day, dayCount]);

  useEffect(() => {
    if (result && resultRef.current) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      resultRef.current.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }, [result]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (useSolarTime && (!place.country || !place.city)) {
      setError('真太陽時需要出生地點，請選擇國家與城市；或切回「鐘錶時間」。');
      return;
    }
    const payload: ZiweiChartPayload = {
      year: birth.year, month: birth.month, day, hour: birth.hour, minute: 0,
      gender, name: '', place: useSolarTime ? `${place.city}, ${place.country}` : '', relation: 'self',
    };
    setError('');
    setLoading(true);
    try {
      const res = await astrologyApi.calculate({
        year: payload.year, month: payload.month, day: payload.day, hour: payload.hour, minute: 0,
        gender,
        time_type: useSolarTime ? 'solar_time' : 'clock_time',
        place: useSolarTime ? { city: place.city, country: place.country } : undefined,
        // 與完整表單一致：公開頁只要本命層的互動命盤，靜態 SVG 作渲染失敗時的備援
        render: true,
        include_chart_json: true,
        include_flow: false,
      });
      setSubmitted(payload);
      setResult(res);
    } catch (err: any) {
      setError(err.message || '排盤失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="mx-auto max-w-[680px]">
        {/* 整組是一張卡片：第一行輸入與送出；第二行時間制（真太陽時在這裡切換）與目前選定的生日；出生地在卡片內展開 */}
        <div className="-mx-2 rounded-banner border border-warm-200 bg-white p-2 shadow-[0_8px_30px_rgba(139,92,246,0.06)] sm:mx-0 sm:p-4">
          {/* 手機版內距刻意收緊：360px 寬、最長的日期（2016/12/31）也要排成一行；更窄時折行而不溢出 */}
          <div className="flex flex-wrap items-center gap-x-1 gap-y-2 sm:gap-x-3">
            <div role="group" aria-label="性別" className="inline-flex h-11 flex-shrink-0 rounded-banner bg-warm-100 p-1">
              {['男', '女'].map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={gender === option}
                  onClick={() => setGender(option)}
                  className={`rounded-[calc(var(--radius-banner)-4px)] px-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-500 sm:px-5 sm:text-base ${
                    gender === option ? 'bg-white font-semibold text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            <PickerButton
              dialogLabel="選擇出生日期"
              button={
                <>
                  <span className="sr-only">出生日期：</span>
                  <span className="sm:hidden">{birth.year}/{birth.month}/{day}</span>
                  <span className="hidden sm:inline">{birth.year} 年 {birth.month} 月 {day} 日</span>
                </>
              }
            >
              <div className="grid w-[17rem] grid-cols-[1.3fr_1fr_1fr] gap-1">
                <WheelColumn label="出生年" options={years} value={birth.year} onChange={(year) => setBirth((p) => ({ ...p, year }))} />
                <WheelColumn label="出生月" options={months} value={birth.month} onChange={(month) => setBirth((p) => ({ ...p, month }))} />
                <WheelColumn label="出生日" options={days} value={day} onChange={(value) => setBirth((p) => ({ ...p, day: value }))} />
              </div>
            </PickerButton>

            <PickerButton
              dialogLabel="選擇出生時間"
              button={
                <>
                  <span className="sr-only">出生時間：</span>
                  {pad(birth.hour)}:00<span className="hidden sm:inline"> {branchOf(birth.hour)}時</span>
                </>
              }
            >
              <div className="w-40">
                <WheelColumn label="出生時間" options={hours} value={birth.hour} onChange={(hour) => setBirth((p) => ({ ...p, hour }))} />
              </div>
            </PickerButton>

            <button
              type="submit"
              disabled={loading}
              className={`${CONTROL} ml-auto flex-shrink-0 bg-brand-purple-600 px-2.5 font-medium text-white transition-colors hover:bg-brand-purple-700 disabled:cursor-not-allowed disabled:opacity-60 sm:px-6`}
            >
              {loading ? '排盤中…' : '立即排盤'}
            </button>
          </div>

          {/* 第二行：時間制切換緊貼在日期／時間按鈕下方，樣式與「男｜女」一致 */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-warm-100 pt-2 sm:mt-3 sm:pt-3">
            <div role="group" aria-label="時間制" className="inline-flex h-9 flex-shrink-0 rounded-banner bg-warm-100 p-1 text-sm">
              <button
                type="button"
                aria-pressed={!useSolarTime}
                onClick={() => { setUseSolarTime(false); setError(''); }}
                className={`${SEGMENT} ${!useSolarTime ? SEGMENT_ON : SEGMENT_OFF}`}
              >
                鐘錶時間
              </button>
              <button
                type="button"
                aria-pressed={useSolarTime}
                aria-expanded={useSolarTime}
                aria-controls={solarPanelId}
                onClick={() => { setUseSolarTime(true); setError(''); }}
                className={`${SEGMENT} ${useSolarTime ? SEGMENT_ON : SEGMENT_OFF}`}
              >
                真太陽時
              </button>
            </div>
            <p aria-live="polite" className="text-sm text-gray-600">
              國曆 {birth.year} 年 {birth.month} 月 {day} 日 {pad(birth.hour)}:00（{branchOf(birth.hour)}時）・{gender}
              {useSolarTime && `・真太陽時${place.city ? `（${place.city}）` : ''}`}
            </p>
          </div>

          {/* 真太陽時：在卡片內展開選出生地（地點清單展開時才載入） */}
          <div id={solarPanelId} hidden={!useSolarTime}>
            {useSolarTime && (
              <>
                <BirthPlaceFields value={place} onChange={(next) => { setPlace(next); setError(''); }} className="mt-2 sm:mt-3" />
                <p className="mt-2 px-1 text-xs text-gray-500">
                  真太陽時會依出生地的經度校正時間，可能讓時辰與鐘錶時間差一個時辰。選好城市後按「立即排盤」。
                </p>
              </>
            )}
          </div>
        </div>

        {error && (
          <div role="alert" className="mt-4 rounded-banner border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </form>

      {result && submitted && (
        <div className="mx-auto mt-10 max-w-5xl">
          <ZiweiChartResult ref={resultRef} result={result} payload={submitted} />
        </div>
      )}
    </>
  );
}
