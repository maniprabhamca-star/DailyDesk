// Flat config, required by ESLint 9 — which eslint-config-next 16 depends on.
//
// There was no ESLint config in this repo at all, and `npm run lint` ran
// `next lint`, which Next 16 removes. So linting was about to go from
// "configured but never run in CI" to "a script that errors". This is the
// smallest config that makes `npm run lint` do something real again.
//
// Imported directly, NOT through @eslint/eslintrc's FlatCompat: eslint-config-next
// is flat-native from v16, and wrapping a flat config in the compatibility shim
// for the old format sends it round in a circle — the error is a stack overflow
// in JSON.stringify complaining that "property 'react' closes the circle".
//
// Deliberately NOT wired into qa.yml. That gate is typecheck, unit,
// service-worker, build and audit — things that fail on facts. Adding a linter
// to it in the same change that upgrades the framework would mix "the app still
// works" with "the app matches a style rule", and the first is what this is for.
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default [
  ...(Array.isArray(nextCoreWebVitals) ? nextCoreWebVitals : [nextCoreWebVitals]),
  ...(Array.isArray(nextTypescript) ? nextTypescript : [nextTypescript]),
  {
    ignores: [
      // .next* with the glob: distDir is 'process.env.NEXT_DIST_DIR || .next',
      // so build output also lands in .next-3004, .next-brand-A and a dozen more
      // from old preview servers. Linting those produced 45,000 findings in
      // minified bundles, which is not a code-quality signal, it is noise that
      // makes the real 20 unreadable.
      '.next*/**',
      'public/**',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      'tests/.fixtures/**',
      'tests/.reports/**',
    ],
  },
];
