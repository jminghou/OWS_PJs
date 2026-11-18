import { LocaleLaunchSettingsPage } from '@ows/admin-app/pages/settings';
import { locales } from '@/i18n/config';

// Polaris 用「語言上線」模式：編輯中的語言只放行持語言預覽通行證的人（middleware.ts）
export default function PolarisSettingsPage() {
  return <LocaleLaunchSettingsPage siteLanguages={locales} />;
}
