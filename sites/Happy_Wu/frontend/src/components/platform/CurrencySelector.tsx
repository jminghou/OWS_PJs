'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { getCurrencySymbol, getCurrencyName, getSupportedCurrencies } from '@/lib/currency';

interface CurrencySelectorProps {
  currentCurrency: string;
  availableCurrencies?: string[];
  language?: string;
}

export default function CurrencySelector({
  currentCurrency,
  availableCurrencies,
  language = 'zh-TW',
}: CurrencySelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 如果有指定可用幣值，使用它；否則使用所有支援的幣值
  const currencies = availableCurrencies && availableCurrencies.length > 0
    ? availableCurrencies
    : getSupportedCurrencies();

  // 如果只有一種幣值，不顯示選擇器
  if (currencies.length <= 1) {
    return null;
  }

  const handleCurrencyChange = (newCurrency: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('currency', newCurrency);

    // 構建新的 URL
    const newUrl = `${pathname}?${params.toString()}`;
    router.push(newUrl);
  };

  return (
    <div className="currency-selector">
      <label htmlFor="currency-select" className="sr-only">
        選擇幣值
      </label>
      <select
        id="currency-select"
        value={currentCurrency}
        onChange={(e) => handleCurrencyChange(e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {currencies.map((currency) => (
          <option key={currency} value={currency}>
            {getCurrencySymbol(currency)} {getCurrencyName(currency, language)}
          </option>
        ))}
      </select>
    </div>
  );
}
