export function PageSkeleton({ title }: { title?: string }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded bg-muted/60" />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-9 w-64 animate-pulse rounded-md bg-muted" />
        <div className="ml-auto h-9 w-32 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="overflow-hidden rounded-md border border-border">
        <div className="h-10 border-b border-border bg-muted/40" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex h-12 items-center gap-4 border-b border-border/60 px-4">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="h-4 flex-1 animate-pulse rounded bg-muted/50" style={{ animationDelay: `${(i + j) * 30}ms` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
