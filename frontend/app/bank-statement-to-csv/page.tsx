import { workflowMetadata, WorkflowLanding } from '@/components/app/statement-workflow';

export const metadata = workflowMetadata('bank-statement-to-csv');

export default function Page() {
  return <WorkflowLanding slug="bank-statement-to-csv" />;
}
