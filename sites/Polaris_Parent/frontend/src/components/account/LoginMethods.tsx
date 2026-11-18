'use client';

/**
 * 會員中心「登入方式」：Google、LINE、密碼三種，一個帳號可以同時有好幾種。
 * - 加連 Google：官方按鈕（彈窗）→ POST /social-auth/me/link/google
 * - 加連 LINE：整頁轉到 LINE，回來落在 /login/social?status=linked
 * - 解除：最後一種登入方式不能解（後端也會擋）
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  GoogleSignInButton,
  LineSignInButton,
  socialAuthApi,
  type MyIdentities,
  type SocialProviderKey,
  type SocialProviders,
} from '@ows/social-auth';
import Alert from '@/components/ui/Alert';

const LABEL: Record<SocialProviderKey, string> = { google: 'Google', line: 'LINE' };

const rowCls = 'flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 sm:flex-row sm:items-center sm:justify-between';
const quietBtn =
  'rounded-full px-3.5 py-2 text-sm text-text transition-colors hover:bg-error-bg hover:text-error-fg ' +
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:opacity-50';

export default function LoginMethods({ justLinked }: { justLinked?: string | null }) {
  const [data, setData] = useState<MyIdentities | null>(null);
  const [providers, setProviders] = useState<SocialProviders>({});
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState(justLinked ? `已連結 ${LABEL[justLinked as SocialProviderKey] || justLinked}，之後可以用它登入。` : '');
  const [busy, setBusy] = useState<SocialProviderKey | null>(null);

  useEffect(() => {
    socialAuthApi.myIdentities().then(setData).catch((e) => setErr((e as Error).message || '載入失敗'));
    socialAuthApi.providers().then((r) => setProviders(r.providers || {})).catch(() => setProviders({}));
  }, []);

  const unlink = async (p: SocialProviderKey) => {
    if (!confirm(`解除 ${LABEL[p]} 連結？之後就不能用 ${LABEL[p]} 登入這個帳號（可以再連回來）。`)) return;
    setBusy(p);
    setErr('');
    setNotice('');
    try {
      setData(await socialAuthApi.unlink(p));
      setNotice(`已解除 ${LABEL[p]} 連結。`);
    } catch (e) {
      setErr((e as Error).message || '解除失敗');
    } finally {
      setBusy(null);
    }
  };

  if (!data) return err ? <Alert tone="error">{err}</Alert> : <p className="text-muted">載入中…</p>;

  const linked = (p: SocialProviderKey) => data.identities.find((i) => i.provider === p);
  const available = (['line', 'google'] as SocialProviderKey[]).filter((p) => data.providers.includes(p) || linked(p));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-[18px] font-normal text-ink md:text-h4">登入方式</h2>
        <p className="mt-1 text-sm text-text">同一個帳號可以連好幾種登入方式，任何一種都能登入，訂單與孩子的資料都在同一個帳號裡。</p>
      </div>
      {notice && <Alert tone="success">{notice}</Alert>}
      {err && <Alert tone="error">{err}</Alert>}

      <ul className="space-y-3">
        {available.map((p) => {
          const id = linked(p);
          return (
            <li key={p} className={rowCls}>
              <div className="min-w-0">
                <div className="font-medium text-ink">{LABEL[p]}</div>
                <div className="text-sm text-muted break-all">
                  {id ? `已連結${id.email ? `（${id.email}）` : id.display_name ? `（${id.display_name}）` : ''}` : '尚未連結'}
                </div>
              </div>
              <div className="flex-shrink-0 sm:w-[260px] sm:flex sm:justify-end">
                {id ? (
                  <button type="button" className={quietBtn} disabled={busy === p} onClick={() => unlink(p)}>
                    {busy === p ? '處理中…' : '解除連結'}
                  </button>
                ) : p === 'line' ? (
                  <LineSignInButton mode="link" next="/account?tab=login&linked=line" />
                ) : providers.google?.client_id ? (
                  <GoogleSignInButton
                    clientId={providers.google.client_id}
                    text="continue_with"
                    submit={socialAuthApi.linkGoogle}
                    onSuccess={(r) => { setData(r as unknown as MyIdentities); setErr(''); setNotice('已連結 Google，之後可以用它登入。'); }}
                    onError={(e) => setErr((e as Error).message || '連結失敗')}
                  />
                ) : null}
              </div>
            </li>
          );
        })}
        <li className={rowCls}>
          <div className="min-w-0">
            <div className="font-medium text-ink">Email＋密碼</div>
            <div className="text-sm text-muted">{data.password_set ? '已設定密碼' : '尚未設定密碼（目前只用社群帳號登入）'}</div>
          </div>
          <Link href="/login?mode=reset" className="flex-shrink-0 rounded-full px-3.5 py-2 text-sm text-blue-500 hover:bg-tint">
            {data.password_set ? '重設密碼' : '設定密碼'}
          </Link>
        </li>
      </ul>
    </div>
  );
}
