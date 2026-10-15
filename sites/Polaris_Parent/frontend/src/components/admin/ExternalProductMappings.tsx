'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { request } from '@ows/platform-api/client';

type Channel = { id: number; channel: string; store_key: string; revision: number };
type Mapping = { id: number; channel_id: number; external_sku: string; revision: number; active: boolean;
  policy_reference: string; review_note: string; valid_until: string;
  profile: { product_code: string; unit_amount: number; currency: string } };
const input = 'block w-full rounded border border-border bg-card p-2 text-sm';

export default function ExternalProductMappings({ channels }: { channels: Channel[] }) {
  const [rows, setRows] = useState<Mapping[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [selected, setSelected] = useState<Mapping | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try { const r = await request<{ mappings: Mapping[]; enabled: boolean }>('/admin/commerce-product-mappings'); setRows(r.mappings); setEnabled(r.enabled); }
    catch (err) { setError(err instanceof Error ? err.message : '無法載入商品對應'); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    const channel = channels.find(c => c.id === Number(data.get('channel_id')));
    try {
      await request('/admin/commerce-product-mappings', { method: 'POST', body: JSON.stringify({
        channel_id: channel?.id, channel_revision: channel?.revision, external_sku: data.get('external_sku'),
        template_item_no: data.get('template_item_no'), revision: selected?.revision,
        active: data.get('active') === 'on', policy_reference: data.get('policy_reference'), review_note: data.get('review_note'),
        valid_until: new Date(String(data.get('valid_until'))).toISOString(),
      }) });
      form.reset(); setSelected(null); await load();
    } catch (err) { setError(err instanceof Error ? err.message : '無法儲存商品對應'); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 rounded border border-border p-4">
    <h2 className="text-lg font-medium">平台商品與官網履約對應</h2>
    <p className="text-xs text-muted-foreground">人工匯入許可不等於官網履約許可。請另行核對該商品可採用的流程，以既有數位報告品項的成交快照建立對應；不複製會員出生資料。</p>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    <button type="button" disabled={busy} onClick={load} className="text-sm underline">重新載入商品對應</button>
    {rows.map(row => <div key={row.id} className="text-sm">
      <p>{channels.find(c => c.id === row.channel_id)?.channel} / {channels.find(c => c.id === row.channel_id)?.store_key}・{row.external_sku} → {row.profile.product_code}・{row.profile.currency} {row.profile.unit_amount}・版本 {row.revision}・{row.active && new Date(row.valid_until) > new Date() ? '已核准' : '停用或到期'}</p>
      <p className="text-xs">有效至 {new Date(row.valid_until).toLocaleString()}・{row.policy_reference}・{row.review_note}</p>
      {enabled && <button type="button" className="underline" onClick={() => setSelected(row)} disabled={busy}>修訂此對應</button>}
    </div>)}
    {!enabled ? <p className="text-sm">契約對應功能尚未開啟。</p> : <form key={`${selected?.id ?? 'new'}-${selected?.revision ?? 0}`} onSubmit={submit} className="space-y-3 border-t border-border pt-3">
      <h3>{selected ? `修訂 ${selected.external_sku}` : '新增商品對應'}</h3>
      <label className="block text-sm">渠道商店<select className={input} name="channel_id" required defaultValue={selected?.channel_id ?? ''}>
        <option value="" disabled>請選擇</option>{channels.filter(c => !selected || c.id === selected.channel_id).map(c => <option key={c.id} value={c.id}>{c.channel} / {c.store_key}</option>)}
      </select></label>
      <label className="block text-sm">平台商品編號<input className={input} name="external_sku" required maxLength={200} defaultValue={selected?.external_sku} readOnly={!!selected} /></label>
      <label className="block text-sm">官網範本品項編號（R 開頭）<input className={input} name="template_item_no" required maxLength={32} /></label>
      <label className="block text-sm">官網履約許可的審查依據<input className={input} name="policy_reference" required maxLength={1000} defaultValue={selected?.policy_reference} /></label>
      <label className="block text-sm">商品規格與政策核對備註<input className={input} name="review_note" required maxLength={1000} defaultValue={selected?.review_note} /></label>
      <label className="block text-sm">下次審查期限（本地時間）<input className={input} name="valid_until" type="datetime-local" required /></label>
      <label className="flex gap-2 text-sm"><input name="active" type="checkbox" defaultChecked={selected?.active ?? false} />確認此平台商品可依對應契約在官網履約</label>
      <button className="rounded border border-border px-3 py-2 text-sm disabled:opacity-50" disabled={busy}>儲存對應審查</button>
      {selected && <button type="button" className="ml-3 text-sm underline" onClick={() => setSelected(null)}>改為新增</button>}
    </form>}
  </section>;
}
