'use client';

/**
 * 代客建單：外部平台（小紅書、Etsy、Pinkoi…）成交的訂單，由管理者代客人把資料填進官網。
 * 一次送出：平台成交（訂單編號、幣別、金額、成品語系）＋客人檔案（既有或新增）＋客製資料＋資料來源（對話紀錄）。
 * 建好就是「平台已成交」的已付款訂單，照常交給紫微建工作單；實體書預設精裝、直接待出打樣。
 * 對話截圖在建單成功後上傳到同一張訂單。
 * 後端：/api/v1/admin/proxy-orders（report_orders.proxy），出生地搜尋走 /api/v1/astrology/places。
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AdminLayout } from '@ows/admin-app';
import { AdminLoadingSkeleton } from '@ows/ui/admin';
import BirthPlaceFields, { EMPTY_BIRTH_PLACE, type BirthPlace } from '@ows/ziwei-app/components/BirthPlaceFields';
import { ArrowLeft, Paperclip, Plus, Trash2 } from 'lucide-react';
import { RELATION_OPTIONS, READER_OPTIONS, CALL_NAME_MAX, DEDICATION_MAX } from '@/lib/report/catalog';
import { LANGUAGE_OPTIONS, channelLabel, fieldLabel } from '@/lib/report/proxy';
import {
  reportOrdersApi,
  type CreateProxyOrderRequest,
  type ExternalCustomer,
  type ProxyConfig,
  type ProxyPlace,
  type SourceKind,
} from '@/lib/api/reportOrders';

const btnPrimary =
  'inline-flex min-h-[40px] md:min-h-0 items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-admin-accent-600 text-white hover:bg-admin-accent-700';
const btnGhost =
  'inline-flex min-h-[40px] md:min-h-0 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-50';
const inputCls =
  'w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-admin-accent-500';
const labelCls = 'mb-1 block text-xs font-medium text-muted-foreground';
const cardCls = 'rounded-xl border border-border bg-card p-4 text-card-foreground';
const tabCls = (on: boolean) =>
  `rounded px-2.5 py-1.5 text-xs font-medium transition ${on ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`;

type TextSourceKind = Exclude<SourceKind, 'screenshot'>;
interface SourceDraft { kind: TextSourceKind; occurred_on: string; summary: string; url: string }

const today = () => new Date().toISOString().slice(0, 10);
const emptySource = (): SourceDraft => ({ kind: 'conversation', occurred_on: today(), summary: '', url: '' });
const SOURCE_KINDS: { value: TextSourceKind; label: string }[] = [
  { value: 'conversation', label: '對話摘錄' },
  { value: 'link', label: '對話連結' },
  { value: 'note', label: '說明' },
];

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className={cardCls}>
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

/** 客人：搜尋既有檔案或新增 */
function CustomerPicker({ picked, onPick, draft, onDraft }: {
  picked: ExternalCustomer | null;
  onPick: (c: ExternalCustomer | null) => void;
  draft: { display_name: string; platform_handle: string; contact_note: string };
  onDraft: (d: { display_name: string; platform_handle: string; contact_note: string }) => void;
}) {
  const [mode, setMode] = useState<'new' | 'existing'>(picked ? 'existing' : 'new');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<ExternalCustomer[]>([]);
  const seq = useRef(0);

  useEffect(() => { if (picked) setMode('existing'); }, [picked]);
  useEffect(() => {
    if (mode !== 'existing' || picked) return;
    const mine = ++seq.current;
    const t = setTimeout(() => {
      reportOrdersApi.externalCustomers(q.trim())
        .then((r) => { if (mine === seq.current) setRows(r.customers); })
        .catch(() => { if (mine === seq.current) setRows([]); });
    }, 250);
    return () => clearTimeout(t);
  }, [q, mode, picked]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        <button type="button" className={tabCls(mode === 'new')} onClick={() => { setMode('new'); onPick(null); }}>新客人</button>
        <button type="button" className={tabCls(mode === 'existing')} onClick={() => setMode('existing')}>回頭客（已有檔案）</button>
      </div>
      {mode === 'new' ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="客人在平台上的名稱 *">
            <input className={inputCls} value={draft.display_name} maxLength={100}
              onChange={(e) => onDraft({ ...draft, display_name: e.target.value })} placeholder="例：Kari Nordmann" />
          </Field>
          <Field label="平台帳號">
            <input className={inputCls} value={draft.platform_handle} maxLength={100}
              onChange={(e) => onDraft({ ...draft, platform_handle: e.target.value })} placeholder="例：kari_n" />
          </Field>
          <Field label="聯絡備註（只有後台看得到）" className="md:col-span-2">
            <input className={inputCls} value={draft.contact_note} maxLength={1000}
              onChange={(e) => onDraft({ ...draft, contact_note: e.target.value })} placeholder="例：偏好英文溝通、晚上回訊" />
          </Field>
        </div>
      ) : picked ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
          <span>{picked.display_name}{picked.platform_handle ? `（${picked.platform_handle}）` : ''}</span>
          <button type="button" className="text-xs text-admin-accent-600 hover:underline dark:text-admin-accent-200" onClick={() => onPick(null)}>改選</button>
        </div>
      ) : (
        <div className="space-y-2">
          <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋客人名稱或平台帳號" />
          {rows.length === 0 ? <p className="text-xs text-muted-foreground">沒有符合的客人</p> : (
            <ul className="max-h-60 overflow-y-auto rounded-md border border-border">
              {rows.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => onPick(c)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted">
                    <span>{c.display_name}{c.platform_handle ? `（${c.platform_handle}）` : ''}</span>
                    {c.claimed && <span className="text-[11px] text-muted-foreground">已認領</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function NewProxyOrderPage() {
  const router = useRouter();
  const [config, setConfig] = useState<ProxyConfig | null>(null);
  const [loadError, setLoadError] = useState('');

  // 平台成交
  const [channelId, setChannelId] = useState<number | ''>('');
  const [externalId, setExternalId] = useState('');
  const [currency, setCurrency] = useState('TWD');
  const [amount, setAmount] = useState('');
  const [language, setLanguage] = useState('zh-TW');
  // 客人
  const [customer, setCustomer] = useState<ExternalCustomer | null>(null);
  const [customerDraft, setCustomerDraft] = useState({ display_name: '', platform_handle: '', contact_note: '' });
  // 主角
  const [variant, setVariant] = useState<'physical' | 'digital'>('physical');
  const [subjectName, setSubjectName] = useState('');
  const [gender, setGender] = useState<'男' | '女'>('女');
  const [relation, setRelation] = useState('self');
  const [birthDate, setBirthDate] = useState('');
  const [birthTime, setBirthTime] = useState('');
  const [timeType, setTimeType] = useState<'clock_time' | 'solar_time'>('clock_time');
  const [placeMode, setPlaceMode] = useState<'search' | 'manual'>('search');
  const [place, setPlace] = useState<BirthPlace>(EMPTY_BIRTH_PLACE);
  const [manual, setManual] = useState({ lat: '', lon: '', tz: '', city: '', country: '' });
  const [reader, setReader] = useState('命主本人');
  const [callName, setCallName] = useState('');
  const [dedication, setDedication] = useState('');
  // 實體書
  const [specKey, setSpecKey] = useState('');
  const [coverName, setCoverName] = useState('');
  const [coverStyle, setCoverStyle] = useState('');
  const [ship, setShip] = useState({ recipient_name: '', recipient_phone: '', country: '', postal_code: '', address: '' });
  // 資料來源
  const [sources, setSources] = useState<SourceDraft[]>([emptySource()]);
  const [files, setFiles] = useState<File[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    reportOrdersApi.proxyConfig()
      .then((c) => {
        setConfig(c);
        const usable = c.channels.filter((ch) => ch.effective);
        if (usable.length === 1) setChannelId(usable[0].id);
        setSpecKey(c.default_spec_key ?? c.specs[0]?.key ?? '');
      })
      .catch((e) => setLoadError(e.message || '載入失敗'));
    // 從客人頁「為這位客人建單」過來：?customer=<id>
    const id = Number(new URLSearchParams(window.location.search).get('customer'));
    if (id) reportOrdersApi.externalCustomer(id).then((r) => setCustomer(r.customer)).catch(() => {});
  }, []);

  const channels = useMemo(() => config?.channels.filter((c) => c.effective) ?? [], [config]);
  const inactive = useMemo(() => config?.channels.filter((c) => !c.effective) ?? [], [config]);
  const exponent = config?.currencies.find((c) => c.code === currency)?.exponent ?? 0;
  const customLanguage = !LANGUAGE_OPTIONS.some((l) => l.value === language);

  const buildPlace = (): ProxyPlace =>
    placeMode === 'manual'
      ? { manual: true, lat: Number(manual.lat), lon: Number(manual.lon), tz: manual.tz.trim(), city: manual.city.trim(), country: manual.country.trim() }
      : place;

  const submit = async () => {
    setError('');
    setFieldErrors({});
    if (channelId === '') {
      setFieldErrors({ channel_id: '請選擇平台' });
      setError('資料有誤，請檢查後再送出');
      return;
    }
    const body: CreateProxyOrderRequest = {
      channel_id: channelId,
      external_order_id: externalId.trim(),
      currency,
      amount: amount.trim(),
      language: language.trim(),
      ...(customer ? { customer_id: customer.id } : { customer: customerDraft }),
      order: {
        variant,
        subject_name: subjectName,
        gender,
        relation_label: relation,
        birth: { date: birthDate, time: birthTime, time_type: timeType },
        place: buildPlace(),
        audience: { reader, call_name: callName, dedication },
        ...(variant === 'physical'
          ? { shipping: ship, physical: { spec_key: specKey || null, quantity: 1, custom: [], spreads: 0 } }
          : {}),
      },
      ...(variant === 'physical' ? { book: { cover_name: coverName || callName, cover_style: coverStyle || undefined, dedication } } : {}),
      sources: sources
        .filter((s) => s.summary.trim() || s.url.trim())
        .map((s) => ({ kind: s.kind, occurred_on: s.occurred_on || undefined, summary: s.summary.trim() || undefined, url: s.url.trim() || undefined })),
    };
    setSubmitting(true);
    try {
      const res = await reportOrdersApi.createProxyOrder(body);
      // 截圖在建單後附到同一張訂單；任何一張失敗都不影響訂單本身，到訂單詳細頁可以補傳
      const failed: string[] = [];
      for (const f of files) {
        try {
          await reportOrdersApi.uploadOrderSource(res.order_no, f, '', '');
        } catch {
          failed.push(f.name);
        }
      }
      const qs = failed.length ? `?upload_failed=${encodeURIComponent(failed.join('、'))}` : res.created ? '' : '?existing=1';
      router.push(`/admin/report-orders/${encodeURIComponent(res.order_no)}${qs}`);
    } catch (e: any) {
      const errs = (e?.errors ?? {}) as Record<string, string | string[]>;
      setFieldErrors(Object.fromEntries(Object.entries(errs).map(([k, v]) => [k, Array.isArray(v) ? v.join('、') : v])));
      setError(e.message || '建單失敗');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  const err = (key: string) => fieldErrors[key] ? <p className="mt-1 text-xs text-destructive">{fieldErrors[key]}</p> : null;

  return (
    <AdminLayout>
      <div className="mx-auto max-w-3xl p-4 md:p-8">
        <Link href="/admin/report-orders" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> 訂單總覽
        </Link>
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">代客建單</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            外部平台成交的訂單，由你把客人的資料填進來。送出後就是已付款訂單，照常交給紫微建工作單；實體書直接進入待出打樣。
          </p>
        </div>

        {loadError && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">{loadError}</div>}
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
            <p>{error}</p>
            {Object.keys(fieldErrors).length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-xs">
                {Object.entries(fieldErrors).map(([k, v]) => <li key={k}>{fieldLabel(k)}：{v}</li>)}
              </ul>
            )}
          </div>
        )}

        {!config ? (!loadError && <AdminLoadingSkeleton variant="list" count={4} />) : channels.length === 0 ? (
          <div className={cardCls}>
            <p className="text-sm">還沒有可以代客建單的平台。</p>
            <p className="mt-1 text-xs text-muted-foreground">
              請先到「外部訂單查證」建立平台渠道（例如 etsy、pinkoi、xiaohongshu），勾選允許人工匯入並設定有效期限。
              {inactive.length > 0 && `目前有 ${inactive.length} 個渠道未開放或已過期：${inactive.map((c) => channelLabel(c.channel)).join('、')}。`}
            </p>
            <Link href="/admin/commerce-intake" className="mt-2 inline-block text-sm text-admin-accent-600 hover:underline dark:text-admin-accent-200">到外部訂單查證 →</Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <Section title="平台成交" hint="金額填平台上實際成交的金額與幣別；同一個平台訂單編號重送不會重複建單。">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="平台 *">
                  <select className={inputCls} value={channelId} onChange={(e) => setChannelId(e.target.value ? Number(e.target.value) : '')}>
                    <option value="">請選擇</option>
                    {channels.map((c) => <option key={c.id} value={c.id}>{channelLabel(c.channel)}（{c.store_key}）</option>)}
                  </select>
                  {err('channel_id')}
                </Field>
                <Field label="平台訂單編號 *">
                  <input className={inputCls} value={externalId} onChange={(e) => setExternalId(e.target.value)} maxLength={200} placeholder="例：3141592653" />
                  {err('external_order_id')}
                </Field>
                <Field label="幣別 *">
                  <select className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    {config.currencies.map((c) => <option key={c.code} value={c.code}>{c.code}・{c.label}</option>)}
                  </select>
                  {err('currency')}
                </Field>
                <Field label="成交金額 *">
                  <input className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal"
                    placeholder={exponent ? `例：899.${'0'.repeat(exponent)}` : '例：2980'} />
                  {err('amount')}
                </Field>
                <Field label="成品語系 *" className="md:col-span-2">
                  <div className="flex gap-2">
                    <select className={inputCls} value={customLanguage ? '__other' : language}
                      onChange={(e) => setLanguage(e.target.value === '__other' ? '' : e.target.value)}>
                      {LANGUAGE_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}（{l.value}）</option>)}
                      <option value="__other">其他語系…</option>
                    </select>
                    {customLanguage && (
                      <input className={inputCls} value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="語系代碼，例：fi、pl" />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">紫微產線照常以中文製作，最後一個節點再翻成這個語系。</p>
                  {err('language')}
                </Field>
              </div>
            </Section>

            <Section title="客人" hint="每位客人一份檔案，之後客人可以用認領碼把訂單接到自己的帳號。外部客人沒有信箱，系統不會寄信給他們。">
              <CustomerPicker picked={customer} onPick={setCustomer} draft={customerDraft} onDraft={setCustomerDraft} />
              {err('customer')}{err('customer_id')}{err('customer.display_name')}
            </Section>

            <Section title="報告主角">
              <div className="flex gap-1">
                <button type="button" className={tabCls(variant === 'physical')} onClick={() => setVariant('physical')}>實體書</button>
                <button type="button" className={tabCls(variant === 'digital')} onClick={() => setVariant('digital')}>數位版（平台允許時）</button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="主角姓名 *">
                  <input className={inputCls} value={subjectName} onChange={(e) => setSubjectName(e.target.value)} maxLength={40} />
                  {err('subject_name')}
                </Field>
                <Field label="性別 *">
                  <select className={inputCls} value={gender} onChange={(e) => setGender(e.target.value as '男' | '女')}>
                    <option value="女">女</option>
                    <option value="男">男</option>
                  </select>
                </Field>
                <Field label="主角是客人的 *">
                  <select className={inputCls} value={relation} onChange={(e) => setRelation(e.target.value)}>
                    {RELATION_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </Field>
                <Field label="出生日期（國曆）*">
                  <input type="date" className={inputCls} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                  {err('birth_date')}
                </Field>
                <Field label="出生時間 *">
                  <input type="time" className={inputCls} value={birthTime} onChange={(e) => setBirthTime(e.target.value)} />
                  {err('birth_time')}
                </Field>
                <Field label="時間類型">
                  <select className={inputCls} value={timeType} onChange={(e) => setTimeType(e.target.value as 'clock_time' | 'solar_time')}>
                    <option value="clock_time">一般時間（當地時鐘）</option>
                    <option value="solar_time">真太陽時</option>
                  </select>
                </Field>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className={labelCls}>出生地 *（兩種時間都需要：判斷時區與夏令時）</span>
                  <div className="flex gap-1">
                    <button type="button" className={tabCls(placeMode === 'search')} onClick={() => setPlaceMode('search')}>選城市</button>
                    <button type="button" className={tabCls(placeMode === 'manual')} onClick={() => setPlaceMode('manual')}>手動經緯度</button>
                  </div>
                </div>
                {placeMode === 'search' ? (
                  <BirthPlaceFields value={place} onChange={setPlace} />
                ) : (
                  <div className="grid gap-3 md:grid-cols-3">
                    <Field label="緯度（北正南負）"><input className={inputCls} value={manual.lat} inputMode="decimal" onChange={(e) => setManual({ ...manual, lat: e.target.value })} placeholder="69.6496" /></Field>
                    <Field label="經度（東正西負）"><input className={inputCls} value={manual.lon} inputMode="decimal" onChange={(e) => setManual({ ...manual, lon: e.target.value })} placeholder="18.9560" /></Field>
                    <Field label="IANA 時區"><input className={inputCls} value={manual.tz} onChange={(e) => setManual({ ...manual, tz: e.target.value })} placeholder="Europe/Oslo" /></Field>
                    <Field label="地名（顯示用）"><input className={inputCls} value={manual.city} onChange={(e) => setManual({ ...manual, city: e.target.value })} placeholder="Kvaløya" /></Field>
                    <Field label="國家（顯示用）"><input className={inputCls} value={manual.country} onChange={(e) => setManual({ ...manual, country: e.target.value })} placeholder="挪威" /></Field>
                  </div>
                )}
                {err('place')}
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <Field label="報告的讀者 *">
                  <select className={inputCls} value={reader} onChange={(e) => setReader(e.target.value)}>
                    {READER_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </Field>
                <Field label="書中對主角的稱呼 *">
                  <input className={inputCls} value={callName} onChange={(e) => setCallName(e.target.value)} maxLength={CALL_NAME_MAX} />
                  {err('call_name')}
                </Field>
                <Field label="題字">
                  <input className={inputCls} value={dedication} onChange={(e) => setDedication(e.target.value)} maxLength={DEDICATION_MAX} />
                  {err('dedication')}
                </Field>
              </div>
            </Section>

            {variant === 'physical' && (
              <Section title="實體書" hint="外部平台的實體書預設精裝；金額以平台成交為準，不另計官網的加價。PDF 只在打樣時給客人看。">
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="規格">
                    <select className={inputCls} value={specKey} onChange={(e) => setSpecKey(e.target.value)}>
                      {config.specs.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                    {err('spec_key')}
                  </Field>
                  <Field label="封面名字（空白＝用書中稱呼）">
                    <input className={inputCls} value={coverName} onChange={(e) => setCoverName(e.target.value)} maxLength={50} placeholder={callName} />
                  </Field>
                  <Field label="封面款式">
                    <select className={inputCls} value={coverStyle} onChange={(e) => setCoverStyle(e.target.value)}>
                      <option value="">之後再決定</option>
                      {config.cover_styles.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="收件人 *">
                    <input className={inputCls} value={ship.recipient_name} onChange={(e) => setShip({ ...ship, recipient_name: e.target.value })} maxLength={100} />
                    {err('recipient_name')}
                  </Field>
                  <Field label="收件電話 *（含國碼）">
                    <input className={inputCls} value={ship.recipient_phone} onChange={(e) => setShip({ ...ship, recipient_phone: e.target.value })} placeholder="+47 912 34 567" />
                    {err('recipient_phone')}
                  </Field>
                  <Field label="國家（兩碼國碼；台灣留空）">
                    <input className={inputCls} value={ship.country} onChange={(e) => setShip({ ...ship, country: e.target.value.toUpperCase() })} maxLength={2} placeholder="NO" />
                    {err('country')}
                  </Field>
                  <Field label="郵遞區號">
                    <input className={inputCls} value={ship.postal_code} onChange={(e) => setShip({ ...ship, postal_code: e.target.value })} maxLength={12} />
                    {err('postal_code')}
                  </Field>
                  <Field label="收件地址 *" className="md:col-span-2">
                    <textarea className={inputCls} rows={2} value={ship.address} onChange={(e) => setShip({ ...ship, address: e.target.value })} maxLength={400} />
                    {err('address')}
                  </Field>
                </div>
                <p className="text-xs text-muted-foreground">海外運費目前不另計。</p>
              </Section>
            )}

            <Section title="資料來源 *" hint="記錄這份出生資料是從哪段對話來的（至少一筆摘錄或連結）。截圖會在建單後附到訂單上，只有後台看得到。">
              {sources.map((s, i) => (
                <div key={i} className="space-y-2 rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <Field label="類型" className="w-32">
                      <select className={inputCls} value={s.kind} onChange={(e) => setSources(sources.map((x, j) => j === i ? { ...x, kind: e.target.value as TextSourceKind } : x))}>
                        {SOURCE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                      </select>
                    </Field>
                    <Field label="對話日期" className="w-40">
                      <input type="date" className={inputCls} value={s.occurred_on} onChange={(e) => setSources(sources.map((x, j) => j === i ? { ...x, occurred_on: e.target.value } : x))} />
                    </Field>
                    {sources.length > 1 && (
                      <button type="button" aria-label="移除這筆" className={btnGhost} onClick={() => setSources(sources.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <textarea className={inputCls} rows={3} maxLength={4000} value={s.summary}
                    onChange={(e) => setSources(sources.map((x, j) => j === i ? { ...x, summary: e.target.value } : x))}
                    placeholder="貼上客人提供出生資料的那段對話，例：Emma, born 2018-07-15 12:00 in Tromsø" />
                  {s.kind === 'link' && (
                    <input className={inputCls} value={s.url} maxLength={1000} placeholder="對話或訂單頁的網址"
                      onChange={(e) => setSources(sources.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} />
                  )}
                  {err(`sources.${i}`)}
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={btnGhost} onClick={() => setSources([...sources, emptySource()])}>
                  <Plus className="h-4 w-4" /> 再加一筆
                </button>
                <label className={`${btnGhost} cursor-pointer`}>
                  <Paperclip className="h-4 w-4" /> 附對話截圖
                  <input type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" className="sr-only"
                    onChange={(e) => { setFiles([...files, ...Array.from(e.target.files ?? [])]); e.target.value = ''; }} />
                </label>
              </div>
              {files.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center justify-between gap-2">
                      <span className="truncate">{f.name}・{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                      <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setFiles(files.filter((_, j) => j !== i))}>移除</button>
                    </li>
                  ))}
                </ul>
              )}
              {err('sources')}
            </Section>

            <div className="flex justify-end">
              <button type="submit" className={btnPrimary} disabled={submitting}>
                {submitting ? '建單中…' : '建立訂單'}
              </button>
            </div>
          </form>
        )}
      </div>
    </AdminLayout>
  );
}
