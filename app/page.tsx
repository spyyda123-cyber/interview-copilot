/**
 * HOME PAGE (/)
 *
 * This is the landing/entry point for the application.
 * It re-exports the /license page component.
 *
 * Purpose: When user visits root URL, they see license activation form.
 * This is the first step in the onboarding flow.
 *
 * Why re-export?
 * - / and /license work identically
 * - Both render license activation UI
 * - User can enter license_key on either route
 *
 * FLOW:
 * 1. User navigates to root (/) or /license
 * 2. Both render the same component: LicensePage
 * 3. ActivationGuard checks session state
 * 4. If activated: redirects to /onboarding
 * 5. If not activated: shows license form
 *
 * See app/license/page.tsx for detailed license activation documentation.
 */
export { default } from "./license/page";
