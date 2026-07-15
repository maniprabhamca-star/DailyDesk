import { devMeta, DevToolPage } from '@/components/tools/dev-tool-page';

export const metadata = devMeta('csv-cleaner');

export default function Page() {
  return <DevToolPage slug="csv-cleaner" />;
}
