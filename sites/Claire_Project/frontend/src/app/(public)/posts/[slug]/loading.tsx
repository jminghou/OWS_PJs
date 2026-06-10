// 文章頁載入骨架：尚未進入 ISR 快取的文章（新發佈後第一次造訪）
// 需要現場向後端取資料，這段期間先顯示與文章版型一致的骨架屏。
export default function PostDetailLoading() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto px-4 sm:px-6 w-full lg:w-[1080px]">
        <main>
          <article className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sm:p-10 lg:px-20 animate-pulse">
            {/* 分類麵包屑 */}
            <div className="h-4 w-40 bg-gray-200 rounded mb-4" />

            {/* 標題 */}
            <div className="h-9 w-3/4 bg-gray-200 rounded mb-3" />
            <div className="h-9 w-1/2 bg-gray-200 rounded mb-6" />

            {/* 封面圖 */}
            <div className="aspect-[16/9] bg-gray-200 rounded-lg mb-8" />

            {/* 內文 */}
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 rounded" />
              <div className="h-4 bg-gray-200 rounded" />
              <div className="h-4 w-5/6 bg-gray-200 rounded" />
              <div className="h-4 bg-gray-200 rounded" />
              <div className="h-4 w-2/3 bg-gray-200 rounded" />
              <div className="h-4 bg-gray-200 rounded" />
              <div className="h-4 w-4/5 bg-gray-200 rounded" />
            </div>
          </article>
        </main>
      </div>
    </div>
  );
}
