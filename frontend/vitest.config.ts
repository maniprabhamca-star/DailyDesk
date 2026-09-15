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
    // 'threads' not 'forks': the default forks pool fails to start its worker
    // when the project path contains a space (e.g. "Mani Documents" on Windows,
    // where the file:// URL encodes it as %20). threads works everywhere.
    pool: 'threads',
    // Cap the workers. Uncapped, one run in four lost a whole FILE:
    //
    //   Error: [vitest-pool]: Failed to start threads worker for test files
    //          tests/unit/pdf-outline.test.ts
    //   Caused by: [vitest-pool-runner]: Timeout waiting for worker to respond
    //   Test Files  26 passed (26)   Tests  270 passed (270)   Errors  1 error
    //
    // "26 passed" where there are 27 files, "270 passed" where there are 285
    // tests, and the word "passed" on both lines. The error line is the only
    // thing separating that from a clean run, and nobody reads past a green
    // summary. This box is 4 cores shared with another project; spawning a
    // worker per file starves the ones trying to start.
    // Vitest 4 moved this to the top level; it was still written as
    // `poolOptions: { threads: { maxThreads: 4 } }` here, which the runner
    // prints a deprecation for and then IGNORES — so the cap was off again and
    // the dropped-file failure above was free to come back. A setting that
    // stops applying without failing is the same class of problem as the bug
    // it was fixing.
    maxWorkers: 4,
    // 5s (the default) is too tight for the tests that read the whole source
    // tree off disk — the accept-list and SEO-metadata suites walk several
    // hundred .ts/.tsx files each, and when 27 files run in parallel on a busy
    // machine they took 9.4s and 6.4s. They were failing about one run in four
    // and getting waved through as "the known flake", which is how a green run
    // stops meaning anything. Nothing is wrong with those assertions; the
    // budget was wrong. A real hang still fails, 25 seconds later.
    testTimeout: 30_000,
    coverage: { provider: 'v8', reportsDirectory: 'tests/.coverage', include: ['lib/**', 'components/**'] },
  },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
