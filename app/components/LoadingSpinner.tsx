export default function LoadingSpinner() {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      <span className="text-xs font-semibold uppercase tracking-[0.2em]">
        Loading
      </span>
    </span>
  );
}
