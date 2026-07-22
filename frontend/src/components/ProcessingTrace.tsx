const STEP_LABELS: Record<string, string> = {
  queued: 'Queued for processing',
  parsing: 'Reading document',
  extracting: 'Extracting entities & relationships',
  chunking: 'Chunking & generating embeddings',
  linking: 'Building knowledge graph links',
  pending_review: 'Waiting for human review',
};
const STEP_ORDER = Object.keys(STEP_LABELS);

export interface ProcessingTraceProps {
  currentStep: string;
  stepStatus: 'pending' | 'active' | 'complete' | 'error';
  stepDetail?: string;
}

export default function ProcessingTrace({ currentStep, stepStatus, stepDetail }: ProcessingTraceProps) {
  const currentIdx = STEP_ORDER.indexOf(currentStep);

  return (
    <div className="pl-1 py-2 space-y-1.5">
      {STEP_ORDER.map((step, idx) => {
        const isPast = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isError = isCurrent && stepStatus === 'error';

        return (
          <div key={step} className="flex items-center gap-2 text-label-sm">
            <span className={`w-4 h-4 flex items-center justify-center rounded-full flex-shrink-0 ${
              isError ? 'bg-red-100 text-red-600'
              : isPast || (isCurrent && stepStatus === 'complete') ? 'bg-lime-100 text-lime-700'
              : isCurrent ? 'bg-primary/10 text-primary' : 'bg-surface-container text-outline'
            }`}>
              <span className={`material-symbols-outlined text-[12px] ${isCurrent && stepStatus === 'active' ? 'animate-spin' : ''}`}>
                {isError ? 'error' : (isPast || (isCurrent && stepStatus === 'complete') ? 'check' : isCurrent ? 'progress_activity' : 'radio_button_unchecked')}
              </span>
            </span>
            <span className={`transition-colors ${
              isCurrent ? 'text-on-surface font-medium' : isPast ? 'text-on-surface-variant' : 'text-outline'
            } ${isCurrent && stepStatus === 'active' ? 'animate-pulse' : ''}`}>
              {STEP_LABELS[step]}
              {isCurrent && stepDetail && <span className="text-outline"> · {stepDetail}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
