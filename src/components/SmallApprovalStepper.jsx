import React from 'react';

const STEPS = [
  { label: 'LEADER', index: 0 },
  { label: 'SUPERV.', index: 1 },
  { label: 'DEAN', index: 2 },
  { label: 'ADMIN', index: 3 },
];

/**
 * Compact approval stepper for use inside event cards.
 * @param {number} currentStepIndex - 0–3 (LEADER → SUPERV. → DEAN → ADMIN).
 */
function SmallApprovalStepper({ currentStepIndex = 0 }) {
  const clamp = Math.max(0, Math.min(3, currentStepIndex));

  return (
    <div className="flex items-start w-full mt-4" role="list" aria-label="Approval progress">
      {STEPS.map((step, i) => {
        const isCompleted = i < clamp;
        const isCurrent = i === clamp;
        const circleClass = isCompleted
          ? 'bg-emerald-500 text-white border-emerald-500'
          : isCurrent
            ? 'bg-amber-400 text-slate-900 border-amber-400'
            : 'bg-slate-200 text-slate-500 border-slate-200';

        return (
          <div key={step.index} className="flex flex-1 items-center min-w-0">
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className={`h-5 w-5 rounded-full border flex items-center justify-center text-[10px] font-semibold ${circleClass}`}
                aria-current={isCurrent ? 'step' : undefined}
                role="listitem"
              >
                {i + 1}
              </div>
              <span className="mt-1 text-[10px] font-medium text-slate-600 whitespace-nowrap">
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-[2px] mx-0.5 min-w-[4px] ${i < clamp ? 'bg-emerald-500' : 'bg-slate-200'}`}
                aria-hidden
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default SmallApprovalStepper;
