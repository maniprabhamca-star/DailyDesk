import { devMeta, DevToolPage } from '@/components/tools/dev-tool-page';

export const metadata = devMeta('csv-to-json');

export default function Page() {
  return <DevToolPage slug="csv-to-json" />;
}
