import { devMeta, DevToolPage } from '@/components/tools/dev-tool-page';

export const metadata = devMeta('sort-lines');

export default function Page() {
  return <DevToolPage slug="sort-lines" />;
}
