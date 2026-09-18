// 排盤頁本身尚未多語化。這個路由的用途是讓帶語系前綴的站內連結、以及語系 cookie 的導向
// （/ziwei → /<語系>/ziwei）有頁面可落地，而不是 404。canonical 沿用預設語系的 /ziwei。
export { default, metadata } from '../../(public)/ziwei/page';
