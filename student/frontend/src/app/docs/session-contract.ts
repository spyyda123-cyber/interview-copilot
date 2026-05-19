/**
 * SESSION STORAGE CONTRACT
 *
 * This file documents the complete contract for sessionStorage keys used throughout
 * the application. These keys are CRITICAL for the user activation flow and backend
 * license validation.
 *
 * IMPORTANT: Backend security depends on these keys being set correctly!
 * - license_key is validated on every protected endpoint
 * - student_id is used to bind plans and resumes to the correct user
 * - company_name ensures users can only access their licensed company's resources
 *
 * When keys are modified:
 * - Update this file
 * - Update SESSION_KEYS_TO_CLEAR in api.ts
 * - Update ActivationGuard.tsx protected routes
 */

/** Core Authentication/Activation Keys */

/**
 * student_id (number)
 * SET BY: /license/activate endpoint response → stored in LicensePage.tsx
 * READ BY: All protected pages, all API calls that need student context
 * PURPOSE: Binds user session to backend student record
 * BACKEND SECURITY: Used to validate license belongs to this student
 * CLEARED ON: License deactivation, 403 Forbidden response
 * BREAKS IF MISSING: User cannot access prep/target/resume pages (redirects to /license)
 */
export const SESSION_KEY_STUDENT_ID = "student_id";

/**
 * student_name (string)
 * SET BY: /license/activate OR /onboarding/create endpoint → stored in LicensePage.tsx
 * READ BY: Display in NavBar, form prefilling in onboarding
 * PURPOSE: User-friendly display of student name
 * NOT SENT TO BACKEND: Only used for UI (welcome messages, etc)
 * CLEARED ON: License deactivation
 * BREAKS IF MISSING: UI doesn't crash, just shows blank
 */
export const SESSION_KEY_STUDENT_NAME = "student_name";

/**
 * student_email (string)
 * SET BY: /license/activate OR /onboarding/create endpoint → stored in LicensePage.tsx
 * READ BY: Form prefilling in onboarding, potential email communication
 * PURPOSE: Contact email for the student
 * NOT SENT TO BACKEND: Stored server-side during student creation
 * CLEARED ON: License deactivation
 * BREAKS IF MISSING: Onboarding page shows empty email field
 */
export const SESSION_KEY_STUDENT_EMAIL = "student_email";

/** Company/Interview Context Keys */

/**
 * company_name (string)
 * SET BY: /license/activate endpoint response → stored in LicensePage.tsx
 * READ BY: Target analysis, resume upload, plan generation (passed to backend)
 * PURPOSE: Identifies which company the student is preparing for
 * BACKEND SECURITY: Backend validates this matches the license company
 * LOCKED: Should not be changed after activation (interview target is company-specific)
 * CLEARED ON: License deactivation
 * BREAKS IF MISSING: Cannot analyze targets or generate plans
 */
export const SESSION_KEY_COMPANY_NAME = "company_name";

/**
 * interview_date (string, ISO format YYYY-MM-DD)
 * SET BY: /license/activate endpoint response → stored in LicensePage.tsx
 * READ BY: Plan generation (days_available calculation), date display in UI
 * PURPOSE: When the student's interview is scheduled
 * BACKEND SECURITY: Backend auto-expires license if today > interview_date
 * LOCKED: Should not be changed (backend re-validates on every protected API call)
 * CLEARED ON: License deactivation or expiry
 * BREAKS IF MISSING: Plan cannot be generated (needs days_available calculation)
 */
export const SESSION_KEY_INTERVIEW_DATE = "interview_date";

/**
 * role (string | null)
 * SET BY: /license/activate endpoint (optional response field) OR /onboarding form
 * READ BY: Passed to analyzeTarget and generatePrep to filter for role-specific guidance
 * PURPOSE: Job title/position (e.g., "Backend Engineer", "Frontend Developer")
 * BACKEND SECURITY: Used for role-specific knowledge base retrieval
 * OPTIONAL: Can be null/empty (defaults to "general" on backend)
 * CLEARED ON: License deactivation
 * BREAKS IF MISSING: Works, but plan will be role-agnostic (not ideal)
 */
export const SESSION_KEY_ROLE = "role";

/** Student Profile Keys */

/**
 * primary_skill (string)
 * SET BY: /onboarding form → sent to /student/create endpoint → stored in session
 * READ BY: Display in profile, used for personalized study plan generation
 * PURPOSE: Main technical skill/specialty (e.g., "Java", "Python", "System Design")
 * BACKEND CONTEXT: Used by Gemini to understand student's background
 * CLEARED ON: Onboarding reset
 * BREAKS IF MISSING: Plan is still generated but less personalized
 */
export const SESSION_KEY_PRIMARY_SKILL = "primary_skill";

/**
 * known_skills (string, comma-separated)
 * SET BY: /onboarding form → sent to /student/create endpoint → stored in session
 * READ BY: Stored for reference, displayed in profile
 * PURPOSE: List of skills student already knows (skill assessment input)
 * BACKEND CONTEXT: Helps Gemini avoid teaching already-known topics
 * FORMAT: "Java,Python,SQL,Git" (comma-separated, sent as JSON array to backend)
 * CLEARED ON: Onboarding reset
 * BREAKS IF MISSING: Plan still generated, just doesn't know what to skip
 */
export const SESSION_KEY_KNOWN_SKILLS = "known_skills";

/**
 * support_mode (string)
 * SET BY: /onboarding form → sent to /student/create endpoint → stored in session
 * READ BY: Displayed in learning preferences, used by backend to tailor plan approach
 * PURPOSE: Personalization preference: "guided" | "self" | "adaptive"
 * BACKEND CONTEXT: Gemini adjusts plan structure based on this mode
 * CLEARED ON: Onboarding reset
 * BREAKS IF MISSING: Defaults to "self" on backend
 */
export const SESSION_KEY_SUPPORT_MODE = "support_mode";

/**
 * tone (string)
 * SET BY: /onboarding form → sent to /student/create endpoint → stored in session
 * READ BY: Displayed in learning preferences
 * PURPOSE: Communication style preference: "supportive" | "direct" | "neutral"
 * BACKEND CONTEXT: Gemini adjusts language tone in generated plan
 * CLEARED ON: Onboarding reset
 * BREAKS IF MISSING: Defaults to "neutral" on backend
 */
export const SESSION_KEY_TONE = "tone";

/**
 * coding_required (string, "true" or "false")
 * SET BY: /onboarding form → sent to /student/create endpoint → stored in session
 * READ BY: Used by backend to decide if coding exercises should be included
 * PURPOSE: Whether to include hands-on coding tasks in the plan
 * BACKEND CONTEXT: Gemini filters tasks based on this
 * CLEARED ON: Onboarding reset
 * BREAKS IF MISSING: Defaults to true on backend (includes coding)
 */
export const SESSION_KEY_CODING_REQUIRED = "coding_required";

/** Target Interview Keys */

/**
 * target_id (number)
 * SET BY: /target/analyze endpoint response → stored after JD analysis complete
 * READ BY: Passed to getPrepStatus, getLatestPrep to fetch plan for specific target
 * PURPOSE: Unique identifier for the job posting/interview being prepared for
 * BACKEND CONTEXT: Maps to TargetInterview record with parsed JD requirements
 * CLEARED ON: When user starts new target (optional)
 * BREAKS IF MISSING: getPrepStatus/getLatestPrep calls fail
 */
export const SESSION_KEY_TARGET_ID = "target_id";

/**
 * jd_text (string)
 * SET BY: /target form (user pastes job description) → stored in session before analysis
 * READ BY: Displayed in target analysis review, passed to /target/analyze
 * PURPOSE: Full job description text for skill extraction and interview analysis
 * BACKEND CONTEXT: Used by Gemini to identify required skills and interview format
 * CLEARED ON: When user updates target
 * BREAKS IF MISSING: Target analysis page shows empty JD
 */
export const SESSION_KEY_JD_TEXT = "jd_text";

/** Resume Keys */

/**
 * resume_id (number)
 * SET BY: /resume/upload endpoint response → stored after PDF upload complete
 * READ BY: Passed to identify which resume was uploaded
 * PURPOSE: Unique identifier for the uploaded resume in the system
 * BACKEND CONTEXT: Maps to Resume record with parsed sections
 * CLEARED ON: When user uploads new resume
 * BREAKS IF MISSING: Cannot reference which resume was used for gap analysis
 */
export const SESSION_KEY_RESUME_ID = "resume_id";

/**
 * CLEARING STRATEGY
 *
 * When to clear session:
 * 1. User clicks "Logout" button (clear everything related to this license)
 * 2. API returns 403 Forbidden (license invalid/expired → redirect to /license)
 * 3. User manually activates a new license (clear old license's data first)
 *
 * What NOT to clear automatically:
 * - student_name, student_email (just cosmetic)
 * - primary_skill, known_skills (safe to keep until license changes)
 * - Never clear while user is offline or in a form (save to state instead)
 *
 * Implementation in api.ts:
 * - SESSION_KEYS_TO_CLEAR array defines what to wipe on 403
 * - clearSessionAndRedirectToLicense() is called from apiFetch on 403 response
 * - Always clear before allowing new login
 */
export const SESSION_CLEAR_ON_LOGOUT = [
  SESSION_KEY_STUDENT_ID,
  SESSION_KEY_STUDENT_NAME,
  SESSION_KEY_STUDENT_EMAIL,
  SESSION_KEY_COMPANY_NAME,
  SESSION_KEY_INTERVIEW_DATE,
  SESSION_KEY_ROLE,
  SESSION_KEY_TARGET_ID,
  SESSION_KEY_RESUME_ID,
  SESSION_KEY_PRIMARY_SKILL,
  SESSION_KEY_KNOWN_SKILLS,
  SESSION_KEY_SUPPORT_MODE,
  SESSION_KEY_TONE,
  SESSION_KEY_CODING_REQUIRED,
  SESSION_KEY_JD_TEXT,
] as const;

/**
 * INITIALIZATION SEQUENCE
 *
 * 1. User visits app → /page.tsx renders
 * 2. ActivationGuard checks for student_id + license_key in session
 * 3. If BOTH exist:
 *    - getSnapshot returns true
 *    - User is considered "activated"
 *    - Protected routes (/onboarding, /prep, etc) become accessible
 *    - NavBar renders with logout button
 * 4. If either missing:
 *    - User redirected to /license page
 *    - User must enter license_key to activate
 * 5. After license activation:
 *    - session keys populated (student_id, license_key, company_name, etc)
 *    - Browser storage event fires
 *    - ActivationGuard detects change via useSyncExternalStore
 *    - User redirected to /onboarding
 *
 * WHY USESYNCEXTERNALSTORE?
 * - next.js 13+ has SSR by default
 * - sessionStorage is only available on client
 * - ActivationGuard must NOT render static content on server with old auth state
 * - useSyncExternalStore with getServerSnapshot=false prevents hydration mismatch
 * - Storage event listener catches session changes from other tabs
 * - Critical for seamless activation flow without page refresh
 */
