'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AdminLayout } from '@ows/admin-app';
import { useAuthStore } from '@ows/platform-api';
import { request } from '@ows/platform-api/client';
import ExternalContractBinding from '@/components/admin/ExternalContractBinding';
import ExternalProductMappings from '@/components/admin/ExternalProductMappings';

type Channel = { id: number; channel: string; store_key: string; revision: number; manual_import: boolean;
  effective: boolean; valid_until: string; policy_reference: string; review_note: string };
type Receipt = { id: number; channel_id: number; external_order_id: string; member_id: number; amount: number; contract_order_no: string | null;
  currency: string; fingerprint: string; channel_revision: number; status: 'pending' | 'verified' | 'rejected' | 'voided';
  lines: { external_sku: string; quantity: number; unit_amount: number }[] };
type Audit = { id: number; actor_id: number; event_type: string; created_at: string;
  detail: { note?: string; evidence_reference?: string; channel_revision: number } };
const input = 'block w-full rounded border border-border bg-card p-2 text-sm';
const button = 'rounded border border-border px-3 py-2 text-sm disabled:opacity-50';
const statuses = { pending: '待查證', verified: '證據已查證', rejected: '已否決', voided: '已作廢' };
const eventLabels: Record<string, string> = { receipt_imported: '匯入待查證', receipt_verified: '確認成交證據',
  receipt_rejected: '否決成交證據', receipt_voided: '作廢成交證據', receipt_contract_bound: '對應契約並發放資格' };
const auditDate = (value: string) => new Date(/(Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`).toLocaleString('zh-TW');
const send = <T,>(path: string, body: unknown, method = 'POST') => request<T>(path, { method, body: JSON.stringify(body) });

function Field({ label, name, value, type = 'text' }: { label: string; name: string; value?: string; type?: string }) {
  return <label className="block text-sm">{label}<input className={input} name={name} type={type} defaultValue={value}
    required maxLength={1000} min={type === 'number' ? 1 : undefined} step={type === 'number' ? 1 : undefined} /></label>;
}

function ChannelForm({ row, done }: { row?: Channel; done: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await send(`/admin/commerce-channels${row ? `/${row.id}` : ''}`, {
        channel: data.get('channel'), store_key: data.get('store_key'), revision: row?.revision,
        manual_import: data.get('manual_import') === 'on', policy_reference: data.get('policy_reference'),
        review_note: data.get('review_note'), valid_until: new Date(String(data.get('valid_until'))).toISOString(),
      }, row ? 'PUT' : 'POST');
      if (!row) form.reset(); done();
    } catch (err) { setError(err instanceof Error ? err.message : '儲存失敗'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-3 rounded border border-border p-4">
    <h3 className="font-medium">{row ? `${row.channel} / ${row.store_key}（版本 ${row.revision}）` : '新增渠道商店'}</h3>
    {!row && <><Field name="channel" label="渠道識別（小寫英文，例如 test-market）" /><Field name="store_key" label="商店識別" /></>}
    <Field name="policy_reference" label="政策審查依據（文件或案件編號）" value={row?.policy_reference} />
    <Field name="review_note" label="審查範圍與備註" value={row?.review_note} />
    <Field name="valid_until" label="下次審查期限（本地時間，儲存時轉為 UTC）" type="datetime-local"
      value={row ? new Date(new Date(row.valid_until).getTime() - new Date(row.valid_until).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : undefined} />
    <label className="flex gap-2 text-sm"><input name="manual_import" type="checkbox" defaultChecked={row?.manual_import ?? false} />允許人工匯入訂單證據</label>
    <p className="text-xs text-muted-foreground">此設定僅開放內部查證。站外啟用、客製流程及平台自動通知仍未開放。</p>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    <button className={button} disabled={busy}>{busy ? '儲存中…' : '儲存審查結果'}</button>
  </form>;
}

function Review({ row, channel, enabled, done }: { row: Receipt; channel?: Channel; enabled: boolean; done: () => void }) {
  const canBind = useAuthStore(s => s.user?.permissions?.includes('report_orders.contracts') ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [events, setEvents] = useState<Audit[]>([]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const data = new FormData(event.currentTarget);
    try {
      await send(`/admin/commerce-receipts/${row.id}/review`, {
        decision: data.get('decision'), note: data.get('note'), evidence_reference: data.get('evidence_reference'),
        payment_confirmed: data.get('payment_confirmed') === 'on', ownership_confirmed: data.get('ownership_confirmed') === 'on',
        fingerprint: row.fingerprint, channel_revision: channel?.revision,
      }); done();
    } catch (err) { setError(err instanceof Error ? err.message : '審查失敗'); }
    finally { setBusy(false); }
  }
  return <article className="space-y-3 rounded border border-border p-4">
    <h3 className="font-medium">{channel?.channel} / {channel?.store_key}・{row.external_order_id} — {statuses[row.status]}</h3>
    <p className="text-sm">會員 #{row.member_id}・{row.currency} {row.amount.toLocaleString()}・審查版本 {row.channel_revision}</p>
    {row.contract_order_no && <p className="text-sm">已對應官網訂單：{row.contract_order_no}。作廢證據將暫停後續履約，不會自動退款或撤回已交付報告。</p>}
    <ul className="text-sm">{row.lines.map((line, i) => <li key={i}>{line.external_sku}：{line.unit_amount} × {line.quantity}</li>)}</ul>
    {enabled && ['pending', 'verified'].includes(row.status) && <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm">審查結果<select className={input} name="decision" defaultValue={row.status === 'verified' ? 'voided' : ''} required>
        <option value="" disabled>請選擇</option>
        {row.status === 'pending' && <><option value="verified" disabled={!channel?.effective}>確認證據</option><option value="rejected">否決</option></>}
        <option value="voided">作廢</option>
      </select></label>
      <Field name="evidence_reference" label="查證依據（平台後台紀錄或內部案件編號）" />
      <Field name="note" label="查證備註／否決或作廢原因" />
      <label className="flex gap-2 text-sm"><input type="checkbox" name="payment_confirmed" />已核對平台付款狀態及成交金額</label>
      <label className="flex gap-2 text-sm"><input type="checkbox" name="ownership_confirmed" />已核對購買者與此會員的歸屬</label>
      {!channel?.effective && <p className="text-sm">渠道已停用或到期，只能否決或作廢。</p>}
      <button className={button} disabled={busy}>{busy ? '儲存中…' : '記錄審查結果'}</button>
    </form>}
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {enabled && canBind && row.status === 'verified' && !row.contract_order_no && <ExternalContractBinding receiptId={row.id} done={done} />}
    <button className={button} disabled={busy} onClick={async () => {
      setBusy(true); setError('');
      try { setEvents((await request<{ events: Audit[] }>(`/admin/commerce-receipts/${row.id}/events`)).events); }
      catch (err) { setError(err instanceof Error ? err.message : '無法讀取紀錄'); }
      finally { setBusy(false); }
    }}>查看稽核紀錄</button>
    {events.map(event => <p key={event.id} className="text-xs text-muted-foreground">
      {auditDate(event.created_at)}・操作者 #{event.actor_id}・{eventLabels[event.event_type] ?? event.event_type}・版本 {event.detail.channel_revision}
      {event.detail.note && `・${event.detail.note}`}{event.detail.evidence_reference && `・依據 ${event.detail.evidence_reference}`}
    </p>)}
  </article>;
}

export default function CommerceIntakePage() {
  const canRead = useAuthStore(s => s.user?.permissions?.includes('report_orders.intake') ?? false);
  const canManage = useAuthStore(s => s.user?.permissions?.includes('report_orders.channels') ?? false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [next, setNext] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [lines, setLines] = useState([{ external_sku: '', quantity: 1, unit_amount: 1 }]);
  const load = useCallback(async () => {
    if (!canRead) return;
    setBusy(true); setMessage('');
    try {
      const [c, r] = await Promise.all([request<{ channels: Channel[]; enabled: boolean }>('/admin/commerce-intake-channels'),
        request<{ receipts: Receipt[]; next_before: number | null }>('/admin/commerce-receipts')]);
      setChannels(c.channels); setEnabled(c.enabled); setReceipts(r.receipts); setNext(r.next_before);
    } catch (err) { setMessage(err instanceof Error ? err.message : '載入失敗'); }
    finally { setBusy(false); }
  }, [canRead]);
  useEffect(() => { void load(); }, [load]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    const form = event.currentTarget;
    const data = new FormData(form);
    const channel = channels.find(c => c.id === Number(data.get('channel_id')));
    try {
      await send('/admin/commerce-receipts', { channel_id: channel?.id, channel_revision: channel?.revision,
        external_order_id: data.get('external_order_id'), member_id: Number(data.get('member_id')),
        currency: 'TWD', amount: Number(data.get('amount')), lines });
      form.reset(); setLines([{ external_sku: '', quantity: 1, unit_amount: 1 }]); await load();
    } catch (err) { setMessage(err instanceof Error ? err.message : '匯入失敗'); }
    finally { setBusy(false); }
  }
  return <AdminLayout><main className="mx-auto max-w-4xl space-y-6 p-6">
    <h1 className="text-2xl font-semibold">外部訂單查證</h1>
    <p className="text-sm text-muted-foreground">保存外部成交證據及查證紀錄。查證後可另行審查與對應單份數位報告契約，確認後才發放資格；不會建立官網收款紀錄。請勿填入出生資料、信用卡或銀行帳號。</p>
    {!canRead ? <p>需要外部訂單審查權限。</p> : <>
      <button className={button} disabled={busy} onClick={load}>重新整理</button>
      {message && <p role="alert" className="text-red-600">{message}</p>}
      {!enabled && <p>此功能目前僅供查閱，尚未開放操作。</p>}
      <section className="space-y-3"><h2 className="text-lg font-medium">渠道政策審查</h2>
        {channels.map(channel => <details key={`${channel.id}-${channel.revision}`} className="rounded border border-border p-3">
          <summary>{channel.channel} / {channel.store_key} — {channel.effective ? '可人工匯入' : '停用或已到期'}（版本 {channel.revision}）</summary>
          <p className="my-2 text-sm">有效至 {new Date(channel.valid_until).toLocaleString()}・依據：{channel.policy_reference}・{channel.review_note}</p>
          {enabled && canManage && <ChannelForm row={channel} done={load} />}
        </details>)}
        {enabled && canManage && <details><summary>新增渠道商店</summary><ChannelForm done={load} /></details>}
      </section>
      {canManage && <ExternalProductMappings channels={channels} />}
      {enabled && <form className="space-y-3 rounded border border-border p-4" onSubmit={submit}>
        <h2 className="text-lg font-medium">匯入待查證訂單</h2>
        <label className="block text-sm">渠道與商店<select className={input} name="channel_id" required defaultValue="">
          <option value="" disabled>請選擇已審查渠道</option>{channels.filter(c => c.effective).map(c => <option key={c.id} value={c.id}>{c.channel} / {c.store_key}</option>)}
        </select></label>
        <Field name="external_order_id" label="平台訂單編號" /><Field name="member_id" label="購買會員編號" type="number" />
        <Field name="amount" label="成交總額（TWD 整數；須等於品項加總）" type="number" />
        {lines.map((line, i) => <fieldset key={i} className="grid gap-2 sm:grid-cols-3"><legend>品項 {i + 1}</legend>
          <label className="text-sm">平台商品編號<input className={input} required maxLength={200} value={line.external_sku} onChange={e => setLines(lines.map((v, n) => n === i ? { ...v, external_sku: e.target.value } : v))} /></label>
          {(['quantity', 'unit_amount'] as const).map(key => <label key={key} className="text-sm">{key === 'quantity' ? '數量' : '單價'}<input className={input} type="number" required min={1} step={1} value={line[key]} onChange={e => setLines(lines.map((v, n) => n === i ? { ...v, [key]: Number(e.target.value) } : v))} /></label>)}
        </fieldset>)}
        <div className="flex gap-2"><button type="button" className={button} disabled={lines.length >= 100} onClick={() => setLines([...lines, { external_sku: '', quantity: 1, unit_amount: 1 }])}>新增品項</button>
          <button type="button" className={button} disabled={lines.length <= 1} onClick={() => setLines(lines.slice(0, -1))}>移除最後品項</button>
          <button className={button} disabled={busy}>匯入待查證</button></div>
      </form>}
      <section className="space-y-3"><h2 className="text-lg font-medium">查證帳本</h2>
        {!receipts.length && <p>尚無外部訂單紀錄。</p>}
        {receipts.map(row => <Review key={`${row.id}-${row.status}-${row.channel_revision}-${row.contract_order_no}-${channels.find(c => c.id === row.channel_id)?.revision}`} row={row} channel={channels.find(c => c.id === row.channel_id)} enabled={enabled} done={load} />)}
        {next !== null && <button className={button} disabled={busy} onClick={async () => {
          setBusy(true);
          try { const r = await request<{ receipts: Receipt[]; next_before: number | null }>(`/admin/commerce-receipts?before=${next}`);
            setReceipts([...receipts, ...r.receipts]); setNext(r.next_before); }
          catch (err) { setMessage(err instanceof Error ? err.message : '載入失敗'); }
          finally { setBusy(false); }
        }}>載入較早紀錄</button>}
      </section>
    </>}
  </main></AdminLayout>;
}
