'use client';

/** 實體書收件資料（結帳與事後加購共用）。欄位錯誤由後端 validate_shipping 回傳。 */
import { clsx } from 'clsx';
import type { ShippingInfo } from '@/lib/api';

export const EMPTY_SHIPPING: ShippingInfo = { recipient_name: '', recipient_phone: '', postal_code: '', address: '' };
export const SHIPPING_LABELS: Record<keyof ShippingInfo, string> = {
  recipient_name: '收件人姓名',
  recipient_phone: '聯絡電話',
  postal_code: '郵遞區號',
  address: '收件地址',
};

// 表單（docs/BRAND_GUIDELINES.md §6.3）
const inputBase =
  'w-full rounded-2xl border-[1.5px] px-[18px] py-[13px] text-base text-ink placeholder:text-muted ' +
  'focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100';
const inputCls = (invalid?: boolean) =>
  clsx(inputBase, invalid ? 'border-error bg-error-bg' : 'border-line-strong bg-white');
const labelCls = 'mb-1.5 block text-sm font-medium text-ink';

export default function ShippingFields({ value, onChange, errors = {}, idPrefix = 'ship' }: {
  value: ShippingInfo;
  onChange: (v: ShippingInfo) => void;
  errors?: Record<string, string>;
  idPrefix?: string;
}) {
  const set = (k: keyof ShippingInfo, v: string) => onChange({ ...value, [k]: v });
  const id = (k: string) => `${idPrefix}-${k}`;
  return (
    <>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={id('name')} className={labelCls}>收件人姓名 *</label>
          <input id={id('name')} value={value.recipient_name} maxLength={50} autoComplete="name"
                 onChange={(e) => set('recipient_name', e.target.value)} required
                 aria-invalid={!!errors.recipient_name} className={inputCls(!!errors.recipient_name)} />
        </div>
        <div>
          <label htmlFor={id('phone')} className={labelCls}>聯絡電話 *</label>
          <input id={id('phone')} type="tel" value={value.recipient_phone} autoComplete="tel"
                 onChange={(e) => set('recipient_phone', e.target.value)}
                 aria-invalid={!!errors.recipient_phone}
                 className={clsx(inputCls(!!errors.recipient_phone), 'font-latin')}
                 placeholder="例如：0912-345-678" required />
        </div>
        <div>
          <label htmlFor={id('postal')} className={labelCls}>郵遞區號</label>
          <input id={id('postal')} inputMode="numeric" value={value.postal_code} maxLength={6} autoComplete="postal-code"
                 onChange={(e) => set('postal_code', e.target.value.replace(/\D/g, ''))}
                 aria-invalid={!!errors.postal_code} className={clsx(inputCls(!!errors.postal_code), 'font-latin')} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={id('address')} className={labelCls}>收件地址 *</label>
          <input id={id('address')} value={value.address} maxLength={200} autoComplete="street-address"
                 onChange={(e) => set('address', e.target.value)} required
                 aria-invalid={!!errors.address} className={inputCls(!!errors.address)} />
        </div>
      </div>
      {Object.keys(errors).length > 0 && (
        <ul className="space-y-1 text-[13px] text-error-fg">
          {Object.entries(errors).map(([k, v]) => (
            <li key={k}>{SHIPPING_LABELS[k as keyof ShippingInfo] ?? k}：{v}</li>
          ))}
        </ul>
      )}
    </>
  );
}
