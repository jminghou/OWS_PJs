'use client';

import { useEffect } from 'react';
import { trackVisit } from '@/lib/attribution';

/** 記下這次進站的來源（UTM／站外 referrer）；不渲染任何東西。說明見 lib/attribution.ts */
export default function AttributionTracker() {
  useEffect(() => {
    trackVisit();
  }, []);
  return null;
}
