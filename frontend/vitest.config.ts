import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Unit + component tests (docs/qa/qa-master-plan.md §2). jsdom for React
// components; pure-logic modules need no environment.
//   npm i -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/dom jsdom
//   npm run test:unit
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}', 'lib/**/*.test.ts'],
    globals: true,
    coverage: { provider: 'v8', reportsDirectory: 'tests/.coverage', include: ['lib/**', 'components/**'] },
  },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
