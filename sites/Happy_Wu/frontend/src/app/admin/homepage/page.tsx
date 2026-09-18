'use client';
import { HomepageSettingsPage } from '@ows/admin-app/pages/homepage';
import { aboutDefaults } from '@/i18n/aboutDefaults';
export default function Page() { return <HomepageSettingsPage enableArticleWall aboutDefaults={aboutDefaults} />; }
