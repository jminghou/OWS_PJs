export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper font-body">
      <div className="flex flex-col items-center gap-4" role="status">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-500" aria-hidden="true" />
        <p className="text-small text-muted">載入中...</p>
      </div>
    </div>
  );
}
