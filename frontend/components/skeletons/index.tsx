/**
 * Skeleton fallback components for Suspense boundaries.
 * Used as fallbacks while dynamically-imported chart and table chunks load.
 */

export function ChartSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading chart…"
      className="animate-pulse rounded-lg bg-gray-100 w-full h-64 flex items-center justify-center"
    >
      <span className="sr-only">Loading chart…</span>
      <div className="space-y-3 w-3/4">
        <div className="h-3 bg-gray-200 rounded w-1/2" />
        <div className="h-32 bg-gray-200 rounded" />
        <div className="h-3 bg-gray-200 rounded w-3/4" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading table…"
      className="animate-pulse rounded-lg border border-gray-200 overflow-hidden"
    >
      <span className="sr-only">Loading table…</span>
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 flex gap-4">
        {[40, 25, 20, 15].map((w, i) => (
          <div key={i} className={`h-3 bg-gray-200 rounded w-${w}`} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-white border-t border-gray-100 px-4 py-3 flex gap-4">
          {[40, 25, 20, 15].map((w, j) => (
            <div key={j} className={`h-3 bg-gray-100 rounded w-${w}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ActivitySkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading activity…"
      className="animate-pulse space-y-3"
    >
      <span className="sr-only">Loading recent activity…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-gray-200 shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="h-3 bg-gray-200 rounded w-3/4" />
            <div className="h-2 bg-gray-100 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}