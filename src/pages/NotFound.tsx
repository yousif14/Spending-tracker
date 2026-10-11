import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="font-display text-3xl">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">That address doesn't exist.</p>
      <Link to="/" className="mt-4 inline-block text-sm font-semibold text-primary">Back to Overview</Link>
    </div>
  );
}
