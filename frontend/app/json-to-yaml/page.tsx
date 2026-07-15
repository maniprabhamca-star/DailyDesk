import { devMeta, DevToolPage } from '@/components/tools/dev-tool-page';

export const metadata = devMeta('json-to-yaml');

export default function Page() {
  return <DevToolPage slug="json-to-yaml" />;
}
