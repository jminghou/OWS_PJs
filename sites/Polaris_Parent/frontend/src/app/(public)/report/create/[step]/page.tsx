import { Suspense } from 'react';
import ReportWizard from '@/components/report/wizard/ReportWizard';

export default async function ReportWizardStepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  return (
    // useSearchParams 需要 Suspense 邊界
    <Suspense fallback={null}>
      <ReportWizard slug={step} />
    </Suspense>
  );
}
