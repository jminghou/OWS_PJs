// 語言預覽通行證的 cookie 名稱（middleware、/api/locale-preview、LocalePreviewBar 共用）。
// PASS：通行證本體，httpOnly，網頁上的程式讀不到；FLAG：只是「顯示預覽提示條」的旗標，不是權限。
export const PASS_COOKIE = 'ows_locale_pass';
export const FLAG_COOKIE = 'ows_locale_preview';
