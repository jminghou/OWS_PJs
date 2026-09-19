'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AdminLayout } from '@ows/admin-app';
import { documentApi, projectApi } from '../api';
import { STUDIO_ROUTES } from '../constants';
import { btnPrimary, btnGhost, inputCls } from '../components/ui';

function Articles() {
  const router=useRouter(); const params=useSearchParams();
  const [result,setResult]=useState<Awaited<ReturnType<typeof documentApi.catalog>> | null>(null);
  const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  const [title,setTitle]=useState(''); const [page,setPage]=useState(1); const [search,setSearch]=useState('');
  const id=Number(params.get('id')); const isNew=params.get('new')==='true';
  useEffect(()=>{documentApi.catalog(page,search).then(setResult).catch(e=>setError(e.message));},[page,search]);
  useEffect(()=>{
    if(!id) return;
    // Adoption is idempotent and preserves article IDs, URLs and all language variants.
    documentApi.adopt(id).then(r=>router.replace(STUDIO_ROUTES.workspace(r.id))).catch(e=>setError(e.message));
  },[id,router]);
  const open=async(articleId:number, documentId:number|null)=>{
    setBusy(true);setError('');
    try{const target=documentId || (await documentApi.adopt(articleId)).id;router.push(STUDIO_ROUTES.workspace(target));}
    catch(e:any){setError(e.message);}finally{setBusy(false);}
  };
  const create=async()=>{
    setBusy(true);setError('');
    try{const p=await projectApi.create({title:title.trim()});const d=await documentApi.create(p.id,{platform:'blog',title:title.trim()});router.push(STUDIO_ROUTES.workspace(d.id));}
    catch(e:any){setError(e.message);}finally{setBusy(false);}
  };
  return <AdminLayout><div className="max-w-4xl mx-auto p-6 space-y-4">
    <h1 className="text-xl font-semibold">網站文章 · Studio</h1>
    <p className="text-sm text-muted-foreground">文章與各語言版本統一在寫作工作區編輯。接管既有文章會保留原網址與發布狀態。</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {id && !error ? <p>正在開啟工作區…</p> : isNew ? <div className="flex gap-2"><input aria-label="新文章標題" className={inputCls} value={title} onChange={e=>setTitle(e.target.value)} placeholder="文章標題"/><button className={btnPrimary} disabled={busy || !title.trim()} onClick={create}>建立草稿</button></div> : <>
      <div className="flex gap-2"><input aria-label="搜尋網站文章" className={inputCls} value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="搜尋網站文章"/><Link href="/admin/articles?new=true" className={btnPrimary}>新增文章</Link></div>
      <ul className="divide-y">{result?.items.map(a=><li key={a.id} className="py-3 flex gap-3 items-center"><span className="text-xs">{a.language} · {a.status}</span><span className="flex-1">{a.title}</span><button className={btnGhost} disabled={busy} onClick={()=>open(a.id,a.document_id)}>{a.document_id?'開啟工作區':'接管至 Studio'}</button></li>)}</ul>
      <div className="flex gap-3"><button disabled={page===1} onClick={()=>setPage(page-1)}>上一頁</button><span>{page} / {result?.pagination.pages || 1}</span><button disabled={!result?.pagination.has_next} onClick={()=>setPage(page+1)}>下一頁</button></div>
    </>}
  </div></AdminLayout>;
}
export default function ArticlesPage(){return <Suspense fallback={<p>載入中…</p>}><Articles/></Suspense>;}
