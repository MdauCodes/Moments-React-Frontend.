export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div className="shimmer aspect-[16/9] w-full" />
      <div className="flex flex-1 flex-col p-6">
        <div className="shimmer h-5 w-3/4 rounded-md" />
        <div className="shimmer mt-2 h-3 w-full rounded-md" />
        <div className="shimmer mt-1.5 h-3 w-2/3 rounded-md" />
        <div className="mt-5 flex items-end justify-between">
          <div className="space-y-1.5">
            <div className="shimmer h-2.5 w-10 rounded-md" />
            <div className="shimmer h-5 w-16 rounded-md" />
          </div>
          <div className="shimmer h-3 w-12 rounded-md" />
        </div>
        <div className="shimmer mt-4 h-9 w-full rounded-full" />
      </div>
    </div>
  );
}
