import { devMeta, DevToolPage } from '@/components/tools/dev-tool-page';

export const metadata = devMeta('text-diff');

export default function Page() {
  return <DevToolPage slug="text-diff" />;
}
