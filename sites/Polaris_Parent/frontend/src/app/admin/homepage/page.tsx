'use client';

// 本站首頁是文字型 landing：第一屏文案走「Hero 介紹」、文章清單走「首頁文章牆」。
import { HomepageSettingsPage } from '@ows/admin-app/pages/homepage';
import { heroIntroDefaults } from '@/i18n/homeLandingContent';

export default function Page() {
  return <HomepageSettingsPage enableArticleWall enableHeroIntro heroIntroDefaults={heroIntroDefaults} />;
}
