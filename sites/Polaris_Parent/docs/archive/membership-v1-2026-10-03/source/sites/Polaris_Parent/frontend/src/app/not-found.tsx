import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center px-6">
        <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">
          找不到頁面
        </h2>
        <p className="text-gray-500 mb-8">
          您要找的頁面不存在或已被移除。
        </p>
        <Link
          href="/"
          className="inline-flex items-center px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
        >
          返回首頁
        </Link>
      </div>
    </div>
  );
}
