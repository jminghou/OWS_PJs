'use client';

import { useState } from 'react';

/** 會員頭像：有圖用圖（社群登入的大頭貼），載入失敗或沒有就顯示首字。 */
export default function MemberAvatar({ src, name, size = 32 }: { src?: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  const style = { width: size, height: size };
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 外部大頭貼網址，不經 next/image 以免各站要設白名單
      <img
        src={src}
        alt=""
        style={style}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="flex-shrink-0 rounded-full object-cover bg-muted"
      />
    );
  }
  return (
    <span
      style={style}
      aria-hidden="true"
      className="flex flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
    >
      {initial}
    </span>
  );
}
