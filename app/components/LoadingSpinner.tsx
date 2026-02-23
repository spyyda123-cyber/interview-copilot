/**
 * LOADING SPINNER COMPONENT
 *
 * Displays animated loading indicator with "Loading" text.
 *
 * Used during:
 * - License activation (activateLicense API call)
 * - Plan generation (polling for Celery task completion)
 * - Target analysis (polling for JD analysis)
 * - Any async operation that needs user feedback
 *
 * Design: Spinning circular border (Tailwind animate-spin)
 * - Gray background circle: border-white/40
 * - White foreground: border-t-white (top border)
 * - Creates rotating effect via CSS animation
 *
 * Styling: Inline-flex with gap, small uppercase "Loading" text
 * Fits seamlessly in buttons and form messages.
 *
 * Example usage:
 * {loading ? <span><LoadingSpinner /> Generating...</span> : "Generate"}
 */
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
