import { devMeta, DevToolPage } from '@/components/tools/dev-tool-page';

export const metadata = devMeta('hash-generator');

export default function Page() {
  return <DevToolPage slug="hash-generator" />;
}
