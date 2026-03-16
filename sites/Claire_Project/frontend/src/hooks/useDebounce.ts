import { useState, useEffect } from 'react';

/**
 * 防抖 Hook - 延遲更新值直到停止變化一段時間
 * @param value - 要防抖的值
 * @param delay - 延遲毫秒數 (預設 300ms)
 * @returns 防抖後的值
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
