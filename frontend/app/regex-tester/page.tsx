import { devMeta, DevToolPage } from '@/components/tools/dev-tool-page';

export const metadata = devMeta('regex-tester');

export default function Page() {
  return <DevToolPage slug="regex-tester" />;
}
