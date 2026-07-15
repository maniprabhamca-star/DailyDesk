import { devMeta, DevToolPage } from '@/components/tools/dev-tool-page';

export const metadata = devMeta('case-converter');

export default function Page() {
  return <DevToolPage slug="case-converter" />;
}
