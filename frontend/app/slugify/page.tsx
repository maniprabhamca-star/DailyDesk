import { devMeta, DevToolPage } from '@/components/tools/dev-tool-page';

export const metadata = devMeta('slugify');

export default function Page() {
  return <DevToolPage slug="slugify" />;
}
