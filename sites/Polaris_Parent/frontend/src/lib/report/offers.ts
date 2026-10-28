/**
 * 購買選項的名稱與入口（2026-10-28 購買流程改版）。
 *
 * 三個各自獨立的購買項目：
 *   數位報告——專心處理數位報告（/report/create?variant=digital）
 *   實體書——先選「全新實體書」或「用我的報告做成書」（/report/book）
 *   專人解讀——一律以「一本書」為中心，從會員中心的「專人解讀」分頁預約（/account?tab=consult）
 *
 * 名稱目前是幫助理解的暫定名，之後要換名字只改這裡。
 */

export const OFFER_NAMES = {
  digital: '數位報告',
  book: '實體書',
  consult: '專人解讀',
  newBook: '全新實體書',
  fromReport: '用我的報告做成書',
} as const;

export const OFFER_HREFS = {
  digital: '/report/create?variant=digital',
  book: '/report/book',
  newBook: '/report/create?variant=physical',
  fromReport: '/report/book/from-report',
  consult: '/account?tab=consult',
  /** 把某一份報告做成書：加購頁只處理實體書 */
  bookFor: (orderNo: string) => `/report/orders/${encodeURIComponent(orderNo)}/addon?item=book`,
  /** 為某一本書預約專人解讀 */
  consultFor: (orderNo: string) => `/account?tab=consult&book=${encodeURIComponent(orderNo)}`,
};
