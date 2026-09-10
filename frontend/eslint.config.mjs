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
  {
    // The React Compiler rules, held at 'warn' rather than 'error'.
    //
    // eslint-plugin-react-hooks 6 (which arrives with eslint-config-next 16)
    // turns on a second family of rules that exist to prepare a codebase for the
    // React Compiler: set-state-in-effect, refs, purity, immutability,
    // static-components, preserve-manual-memoization. They fire 116 times here.
    // We have not adopted the compiler, and they are not the classic
    // "this is a bug" hooks rules — rules-of-hooks and exhaustive-deps are, and
    // those stay exactly as the Next config sets them.
    //
    // set-state-in-effect is the clearest case for not treating these as errors
    // yet. It flags components/app/last-improved.tsx, where setting state in an
    // effect is the CORRECT fix — reading a client-only value after mount is how
    // you avoid a hydration mismatch, and that exact change fixed a real bug on
    // 2026-09-08 where every prerendered tool page disagreed with itself about
    // what day it was. A rule that flags the fix for a real bug is not something
    // to obey silently, and it is not something to switch off silently either.
    //
    // So: visible on every run, not blocking. Revisit as one piece of work if we
    // ever adopt the compiler — that is when these become worth obeying, because
    // that is when they start describing real constraints rather than
    // preferences.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
  {
    // An underscore prefix means "deliberately unused" — a positional argument
    // that must exist for the ones after it, or a destructured value kept for
    // documentation. Without this the only way to satisfy the rule is to delete
    // something whose absence changes meaning, or to bury it under a disable
    // comment. edit-tool.tsx uses _a and _h exactly this way.
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      }],
    },
  },
];
