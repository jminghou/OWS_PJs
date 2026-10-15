'use client';

/**
 * 尚未開放的後台頁面：先佔好選單位置（訂單管理／行銷管理），之後依本站的產品再接上實際功能。
 */
import { AdminLayout } from '@ows/admin-app';
import { AdminEmptyState } from '@ows/ui/admin';

export default function ComingSoonPage({ title, description }: { title: string; description?: string }) {
  return (
    <AdminLayout>
      <div className="p-4 md:p-6">
        <h1 className="mb-4 text-xl font-semibold text-foreground">{title}</h1>
        <div className="rounded-xl border border-border bg-card">
          <AdminEmptyState title="尚未開放" description={description ?? '這個功能還在規劃中，之後會依本站的產品接上。'} />
        </div>
      </div>
    </AdminLayout>
  );
}
