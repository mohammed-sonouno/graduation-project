/**
 * Compact stepper: Supervisor → Dean → Admin (approval stages only).
 * Color rules (red is only for the step that rejected, never for current pending):
 * - Pending current step = yellow (amber)
 * - Approved completed steps = green
 * - Rejected step (rejectedAtStep) = red
 * - Future steps = gray
 * Examples: pending_supervisor → S=yellow, D=gray, A=gray; after S approval → S=green, D=yellow, A=gray;
 * supervisor rejected → S=red, D=gray, A=gray; dean rejected → S=green, D=red, A=gray.
 */
const STEPS = ['Supervisor', 'Dean', 'Admin'];

function stepIndexFromStatus(status, approvalStep, requestedChangesAtStep) {
  if (!status) return approvalStep != null ? Math.min(2, Math.max(0, Number(approvalStep))) : 0;
  switch (status) {
    case 'pending_supervisor':
    case 'pending':
      return 0;
    case 'pending_dean':
      return 1;
    case 'pending_admin':
      return 2;
    case 'approved':
      return 2;
    case 'changes_requested':
      return requestedChangesAtStep != null && Number(requestedChangesAtStep) >= 0
        ? Math.min(2, Math.max(0, Number(requestedChangesAtStep)))
        : (approvalStep != null ? Math.min(2, Math.max(0, Number(approvalStep))) : 0);
    case 'rejected':
    case 'draft':
    default:
      return approvalStep != null ? Math.min(2, Math.max(0, Number(approvalStep))) : 0;
  }
}

export default function SmallApprovalStepper({ currentStepIndex, status, approvalStep, rejectedAtStep, requestedChangesAtStep }) {
  const index = currentStepIndex != null && status == null
    ? Math.max(0, Math.min(currentStepIndex, STEPS.length - 1))
    : Math.max(0, Math.min(stepIndexFromStatus(status, approvalStep, requestedChangesAtStep), STEPS.length - 1));
  const stepNum = Number(rejectedAtStep);
  const isRejectedEvent = status === 'draft' && !Number.isNaN(stepNum) && stepNum >= 0 && stepNum <= 2;
  const rejectedStep = isRejectedEvent ? stepNum : null;

  const stepStyle = (i) => {
    if (rejectedStep !== null) {
      if (i === rejectedStep) return 'text-red-600';
      if (i < rejectedStep) return 'text-emerald-600';
      return 'text-slate-400';
    }
    if (status === 'approved') return 'text-emerald-600';
    if (i < index) return 'text-emerald-600';
    if (i === index) return 'text-amber-600';
    return 'text-slate-400';
  };
  const lineStyle = (i) => {
    if (rejectedStep !== null) {
      if (i < rejectedStep) return 'bg-emerald-400';
      if (i === rejectedStep) return 'bg-red-300';
      return 'bg-slate-200';
    }
    if (status === 'approved') return 'bg-emerald-400';
    if (i < index) return 'bg-emerald-400';
    if (i === index) return 'bg-amber-400';
    return 'bg-slate-200';
  };

  return (
    <div className="flex items-center gap-1" aria-label={`Approval: ${STEPS[index]}`}>
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center min-w-0">
          <span className={`text-[10px] font-semibold uppercase tracking-wider truncate ${stepStyle(i)}`}>
            {label}
          </span>
          {i < STEPS.length - 1 && (
            <span className={`mx-1.5 w-4 h-px shrink-0 ${lineStyle(i)}`} aria-hidden />
          )}
        </div>
      ))}
    </div>
  );
}
