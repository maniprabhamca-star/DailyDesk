import { devMeta, DevToolPage } from '@/components/tools/dev-tool-page';

export const metadata = devMeta('url-encode');

export default function Page() {
  return <DevToolPage slug="url-encode" />;
}
