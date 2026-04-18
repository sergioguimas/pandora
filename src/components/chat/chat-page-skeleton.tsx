import { Skeleton } from "@/components/ui/skeleton";

export function ChatPageSkeleton() {
  return (
    <main className="flex h-screen bg-background text-foreground">
      <aside className="hidden w-full max-w-sm border-r border-border/60 bg-card/60 p-4 md:block">
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </aside>

      <section className="flex flex-1 flex-col">
        <div className="border-b border-border/60 p-4">
          <Skeleton className="h-12 w-72 rounded-2xl" />
        </div>

        <div className="flex-1 space-y-4 p-6">
          <Skeleton className="h-16 w-[58%] rounded-3xl" />
          <Skeleton className="ml-auto h-16 w-[40%] rounded-3xl" />
          <Skeleton className="h-24 w-[62%] rounded-3xl" />
        </div>

        <div className="border-t border-border/60 p-4">
          <Skeleton className="h-16 w-full rounded-3xl" />
        </div>
      </section>
    </main>
  );
}