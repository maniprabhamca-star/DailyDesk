import { devMeta, DevToolPage } from '@/components/tools/dev-tool-page';

export const metadata = devMeta('timestamp-converter');

export default function Page() {
  return <DevToolPage slug="timestamp-converter" />;
}
