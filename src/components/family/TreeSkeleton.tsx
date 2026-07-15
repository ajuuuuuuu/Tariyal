import { Skeleton } from "@/components/ui/skeleton";

export function TreeSkeleton() {
  return (
    <div className="h-full w-full flex flex-col gap-4 p-6 bg-background">
      {/* Top row of skeleton nodes */}
      <div className="flex justify-around mb-8">
        <Skeleton className="h-24 w-20 rounded-lg" />
        <Skeleton className="h-24 w-20 rounded-lg" />
        <Skeleton className="h-24 w-20 rounded-lg" />
      </div>

      {/* Middle section */}
      <div className="flex justify-around mb-8">
        <Skeleton className="h-24 w-20 rounded-lg" />
        <Skeleton className="h-24 w-20 rounded-lg" />
        <Skeleton className="h-24 w-20 rounded-lg" />
        <Skeleton className="h-24 w-20 rounded-lg" />
      </div>

      {/* Bottom section */}
      <div className="flex justify-around">
        <Skeleton className="h-24 w-20 rounded-lg" />
        <Skeleton className="h-24 w-20 rounded-lg" />
        <Skeleton className="h-24 w-20 rounded-lg" />
      </div>

      {/* Connection lines simulation */}
      <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2">
        <Skeleton className="h-16 w-1 bg-muted" />
      </div>
    </div>
  );
}
