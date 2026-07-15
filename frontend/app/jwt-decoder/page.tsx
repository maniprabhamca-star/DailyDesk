import { devMeta, DevToolPage } from '@/components/tools/dev-tool-page';

export const metadata = devMeta('jwt-decoder');

export default function Page() {
  return <DevToolPage slug="jwt-decoder" />;
}
