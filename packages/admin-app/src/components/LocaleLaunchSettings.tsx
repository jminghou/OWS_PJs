'use client';

import { useEffect, useState } from 'react';
import { i18nApi, localePreviewApi } from '@ows/platform-api';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@ows/ui/lib/constants';
import Button from '@ows/ui/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@ows/ui/ui/Card';

type LangState = 'off' | 'editing' | 'public';

const STATES: { value: LangState; label: string }[] = [
  { value: 'off', label: '關閉' },
  { value: 'editing', label: '編輯中' },
  { value: 'public', label: '已公開' },
];

const INVITE_DAYS = [1, 3, 7, 14];

const nameOf = (code: string) => SUPPORTED_LANGUAGES.find((l) => l.code === code)?.name ?? code;
const flagOf = (code: string) => SUPPORTED_LANGUAGES.find((l) => l.code === code)?.flag;
const fmt = (unix: number) => new Date(unix * 1000).toLocaleString('zh-TW', { hour12: false });

/**
 * 語言上線設定（站台有「編輯中」語言時用）。
 * 關閉：後台不能編輯、前台沒有；編輯中：後台可編輯，前台只有持語言預覽通行證的人看得到；已公開：所有人看得到。
 * siteLanguages＝前台實際有頁面的語系（站台 i18n/config.ts）。
 */
export default function LocaleLaunchSettings({ siteLanguages }: { siteLanguages: readonly string[] }) {
  const [defaultLanguage, setDefaultLanguage] = useState(DEFAULT_LANGUAGE);
  const [states, setStates] = useState<Record<string, LangState>>({});
  const [saved, setSaved] = useState<Record<string, LangState>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [inviteLangs, setInviteLangs] = useState<string[]>([]);
  const [inviteDays, setInviteDays] = useState(3);
  const [inviteNote, setInviteNote] = useState('');
  const [invite, setInvite] = useState<{ url: string; expires: number } | null>(null);

  useEffect(() => {
    i18nApi.getSettings({ cache: 'no-store' }).then((s) => {
      const def = s.default_language || DEFAULT_LANGUAGE;
      const editable = s.enabled ? s.languages : [def];
      const pub = s.locale_gate ? s.public_languages ?? [def] : editable;
      const next: Record<string, LangState> = {};
      for (const code of siteLanguages) {
        next[code] = code === def || pub.includes(code) ? 'public' : editable.includes(code) ? 'editing' : 'off';
      }
      setDefaultLanguage(def);
      setStates(next);
      setSaved(next);
    }).catch((e) => setError(e.message || '讀取設定失敗')).finally(() => setLoading(false));
  }, [siteLanguages]);

  const editing = siteLanguages.filter((c) => saved[c] === 'editing');
  const dirty = JSON.stringify(states) !== JSON.stringify(saved);

  const save = async () => {
    const becomingPublic = siteLanguages.filter((c) => states[c] === 'public' && saved[c] !== 'public');
    if (becomingPublic.length && !confirm(`公開後所有訪客與搜尋引擎都看得到：${becomingPublic.map(nameOf).join('、')}。確定公開？`)) return;
    setBusy(true); setError('');
    try {
      const languages = siteLanguages.filter((c) => states[c] !== 'off');
      const language_names = Object.fromEntries(languages.map((c) => [c, nameOf(c)]));
      await i18nApi.updateSettings({
        enabled: true,
        default_language: defaultLanguage,
        languages,
        language_names,
        public_languages: siteLanguages.filter((c) => states[c] === 'public'),
      });
      setSaved(states);
      setInviteLangs((l) => l.filter((c) => states[c] === 'editing'));
    } catch (e: any) { setError(e.message || '儲存失敗'); }
    finally { setBusy(false); }
  };

  // 戴上通行證：/api/locale-preview 由站台前端驗證後寫入 httpOnly cookie，再導到第一個編輯中的語言
  const openPreview = async () => {
    setBusy(true); setError('');
    try {
      const pass = await localePreviewApi.pass();
      const next = editing.length ? `/${editing[0]}` : '/';
      window.open(`/api/locale-preview?token=${encodeURIComponent(pass.token)}&next=${encodeURIComponent(next)}`, '_blank');
    } catch (e: any) { setError(e.message || '無法開啟預覽'); }
    finally { setBusy(false); }
  };

  const createInvite = async () => {
    setBusy(true); setError(''); setInvite(null);
    try {
      const pass = await localePreviewApi.invite({ languages: inviteLangs, days: inviteDays, note: inviteNote });
      const url = `${window.location.origin}/api/locale-preview?token=${encodeURIComponent(pass.token)}&next=${encodeURIComponent(`/${inviteLangs[0]}`)}`;
      setInvite({ url, expires: pass.expires_at });
    } catch (e: any) { setError(e.message || '無法產生邀請連結'); }
    finally { setBusy(false); }
  };

  const revokeAll = async () => {
    if (!confirm('停用所有已發出的語言預覽通行證？包含你自己的與所有邀請連結，之後要預覽需重新開啟。')) return;
    setBusy(true); setError('');
    try { await localePreviewApi.revokeAll(); setInvite(null); alert('所有通行證已停用'); }
    catch (e: any) { setError(e.message || '停用失敗'); }
    finally { setBusy(false); }
  };

  if (loading) return <p className="text-sm text-muted-foreground">載入中…</p>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle>語言上線</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <ul className="text-sm text-muted-foreground space-y-1 rounded-md border border-border bg-muted/40 p-3">
            <li><strong className="text-foreground">編輯中</strong>：後台可以編輯、發布內容；前台只有持「語言預覽通行證」的人看得到，訪客會被導回繁體中文，搜尋引擎不會收錄。</li>
            <li><strong className="text-foreground">已公開</strong>：所有訪客與搜尋引擎都看得到。</li>
            <li><strong className="text-foreground">關閉</strong>：後台不能編輯這個語言（已有內容不會刪除）。</li>
          </ul>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="divide-y divide-border">
            {siteLanguages.map((code) => {
              const isDefault = code === defaultLanguage;
              return (
                <div key={code} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {flagOf(code) && <span aria-hidden className="text-lg">{flagOf(code)}</span>}
                    <span className="text-sm font-medium text-foreground">{nameOf(code)}</span>
                    <span className="text-xs text-muted-foreground">{code}</span>
                    {isDefault && <span className="text-xs rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 px-2 py-0.5">預設語言</span>}
                  </div>
                  <div role="radiogroup" aria-label={`${nameOf(code)} 狀態`} className="inline-flex rounded-md border border-border overflow-hidden">
                    {STATES.map((s) => (
                      <button key={s.value} type="button" role="radio" aria-checked={states[code] === s.value}
                        disabled={isDefault || busy}
                        onClick={() => setStates({ ...states, [code]: s.value })}
                        className={`px-3 py-1.5 text-xs min-h-[36px] ${states[code] === s.value
                          ? s.value === 'public' ? 'bg-emerald-600 text-white' : s.value === 'editing' ? 'bg-amber-500 text-white' : 'bg-muted text-foreground'
                          : 'bg-card text-muted-foreground hover:bg-muted'} disabled:opacity-60`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <Button type="button" onClick={save} disabled={busy || !dirty}>{busy ? '處理中…' : '儲存變更'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>語言預覽通行證</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">我自己預覽</h3>
            <p className="text-sm text-muted-foreground">在這台瀏覽器開啟預覽，12 小時內可以瀏覽所有編輯中的語言。網站頂端會出現黃色的「語言預覽模式」提示條，可以在那裡切換語言或離開預覽。</p>
            <Button type="button" onClick={openPreview} disabled={busy}>開啟語言預覽</Button>
          </section>

          <section className="space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">邀請翻譯／審稿人</h3>
            <p className="text-sm text-muted-foreground">對方不需要後台帳號。拿到連結的人都能看，請只傳給需要的人；用完可以按下方「停用所有通行證」。</p>
            {editing.length === 0 ? (
              <p className="text-sm text-muted-foreground">目前沒有編輯中的語言。</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {editing.map((code) => (
                    <label key={code} className="inline-flex items-center gap-1.5 text-sm rounded-md border border-border px-2 py-1">
                      <input type="checkbox" checked={inviteLangs.includes(code)}
                        onChange={(e) => setInviteLangs(e.target.checked ? [...inviteLangs, code] : inviteLangs.filter((c) => c !== code))} />
                      {nameOf(code)}
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <label className="inline-flex items-center gap-1.5">有效
                    <select value={inviteDays} onChange={(e) => setInviteDays(Number(e.target.value))} className="rounded-md border border-border bg-card px-2 py-1">
                      {INVITE_DAYS.map((d) => <option key={d} value={d}>{d} 天</option>)}
                    </select>
                  </label>
                  <input value={inviteNote} onChange={(e) => setInviteNote(e.target.value)} maxLength={80}
                    placeholder="備註（例如：日文翻譯 山田）" aria-label="邀請備註"
                    className="flex-1 min-w-[12rem] rounded-md border border-border bg-card px-2 py-1" />
                </div>
                <Button type="button" variant="outline" onClick={createInvite} disabled={busy || inviteLangs.length === 0}>產生邀請連結</Button>
                {invite && (
                  <div className="space-y-1">
                    <input readOnly value={invite.url} aria-label="邀請連結" onFocus={(e) => e.currentTarget.select()}
                      className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-xs font-mono" />
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>到期：{fmt(invite.expires)}</span>
                      <button type="button" className="underline" onClick={() => navigator.clipboard?.writeText(invite.url).then(() => alert('已複製'))}>複製</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="space-y-2 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">停用所有通行證</h3>
            <p className="text-sm text-muted-foreground">連結外流或合作結束時使用。所有人（包含你）的通行證立即失效，約 1 分鐘內生效。</p>
            <Button type="button" variant="outline" onClick={revokeAll} disabled={busy}>停用所有通行證</Button>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
