export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="py-16 text-center">
      <h1 className="font-display text-2xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Coming in the next update.</p>
    </div>
  );
}
