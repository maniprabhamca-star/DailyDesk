import { devMeta, DevToolPage } from '@/components/tools/dev-tool-page';

export const metadata = devMeta('base64');

export default function Page() {
  return <DevToolPage slug="base64" />;
}
