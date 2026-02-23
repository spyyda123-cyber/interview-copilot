/**
 * PREP PAGE (/prep)
 *
 * This is an alias for /plan page.
 * Both /prep and /plan routes render the same component for backward compatibility.
 *
 * Purpose: Seamless routing - users arriving via /prep or /plan see same learning plan UI.
 *
 * Why two routes?
 * - Backend uses /prep/generate, /prep/status, /prep/latest endpoints
 * - Frontend may use either /prep or /plan route name (interchangeable)
 * - Both work identically
 *
 * See app/plan/page.tsx for full documentation.
 */
export { default } from "../plan/page";
