/**
 * STATUS PAGE (/status)
 *
 * Displays system health status - checks if backend API and all dependencies are operational.
 *
 * Purpose: System monitoring and debugging page for admins/users.
 * Shows real-time status of: API, Database, Redis, Celery Worker, OpenAI key, Gemini key.
 *
 * ENDPOINT: GET /system/status (public, no auth required)
 * RESPONSE: SystemStatusResponse
 * - api: "ok" | "error"
 * - database: "ok" | "error"
 * - redis: "ok" | "error"
 * - celery_worker: "ok" | "error"
 * - openai_key: "configured" | "missing"
 * - details: Optional detailed error messages
 *
 * This page does NOT require license activation (public route).
 * Used for: Monitoring, debugging connection issues, infrastructure health checks.
 *
 * Renders from: src/app/status/page.tsx (imported, not local file)
 * This allows shared component between app/ and src/ directory structures.
 */
export { default } from "@/src/app/status/page";
