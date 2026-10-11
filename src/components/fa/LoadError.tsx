import { Button } from '@/components/ui/button';

/** Shown when the first feed load fails (later failures keep the cached data and show the offline banner) */
export function LoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className="py-16 text-center">
      <p className="text-sm text-muted-foreground">Couldn't load {what}.</p>
      <Button className="mt-4" onClick={onRetry}>Try again</Button>
    </div>
  );
}
