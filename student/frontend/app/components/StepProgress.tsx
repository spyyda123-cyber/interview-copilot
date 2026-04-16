"use client";

const STEPS = [
  { number: 1, label: "Profile" },
  { number: 2, label: "Target" },
  { number: 3, label: "Resume" },
  { number: 4, label: "Plan" },
];

type StepProgressProps = {
  currentStep: number;
};

export default function StepProgress({ currentStep }: StepProgressProps) {
  return (
    <div className="flex items-center gap-0 w-full max-w-md mx-auto">
      {STEPS.map((step, index) => {
        const isCompleted = step.number < currentStep;
        const isActive = step.number === currentStep;

        return (
          <div key={step.number} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`step-dot ${
                  isCompleted
                    ? "step-dot-completed"
                    : isActive
                    ? "step-dot-active"
                    : "step-dot-pending"
                }`}
              >
                {isCompleted ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  step.number
                )}
              </div>
              <span
                className={`text-[11px] font-medium ${
                  isActive
                    ? "text-[var(--accent)]"
                    : isCompleted
                    ? "text-[var(--success)]"
                    : "text-[var(--text-muted)]"
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`step-line mx-2 mb-5 ${
                  isCompleted
                    ? "step-line-completed"
                    : isActive
                    ? "step-line-active"
                    : ""
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
