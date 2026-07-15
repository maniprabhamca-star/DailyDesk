import { devMeta, DevToolPage } from '@/components/tools/dev-tool-page';

export const metadata = devMeta('html-entities');

export default function Page() {
  return <DevToolPage slug="html-entities" />;
}
