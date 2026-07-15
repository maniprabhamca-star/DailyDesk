import { devMeta, DevToolPage } from '@/components/tools/dev-tool-page';

export const metadata = devMeta('lorem-ipsum');

export default function Page() {
  return <DevToolPage slug="lorem-ipsum" />;
}
