// DiemDesk load test — exercises the REAL bottleneck (bcrypt on login), not the
// trivial /health path. Run against the backend directly to measure origin
// capacity (bypasses Cloudflare/basic-auth), or against the public URL to test
// the whole edge->origin path.
//
// Setup (once): create a throwaway login user the test can reuse, so we hit
// bcrypt + JWT without inserting thousands of junk rows:
//   curl -s -X POST http://127.0.0.1:4000/api/auth/register \
//     -H 'Content-Type: application/json' \
//     -d '{"name":"loadtest","email":"loadtest@diemdesk.local","password":"LoadTest123!"}'
//
// Run (install k6 first: https://k6.io/docs/get-started/installation/):
//   BASE_URL=http://127.0.0.1:4000 \
//   LT_EMAIL=loadtest@diemdesk.local LT_PASS='LoadTest123!' \
//   k6 run ops/loadtest/auth-load.js
//
// Read the summary: http_req_duration p95 + checks pass rate + the point where
// p95 crosses ~300ms is your current auth ceiling. Compare req/s to expected
// signups+logins per second at your target user count.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://127.0.0.1:4000';
const EMAIL = __ENV.LT_EMAIL || 'loadtest@diemdesk.local';
const PASS = __ENV.LT_PASS || 'LoadTest123!';

const loginFail = new Rate('login_failed');
const loginDur = new Trend('login_duration_ms', true);

// Ramp up in stages so you can see where latency degrades, not just a single point.
export const options = {
  scenarios: {
    // ~95% of real traffic is light reads/page loads; model that.
    browse: {
      executor: 'ramping-vus', exec: 'browse', startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },
        { duration: '1m', target: 300 },
        { duration: '30s', target: 0 },
      ],
    },
    // The expensive path: logins (bcrypt). Kept lower, like real signup/login mix.
    login: {
      executor: 'ramping-vus', exec: 'login', startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 40 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],          // <1% errors
    'login_duration_ms': ['p(95)<300'],      // auth p95 under 300ms = healthy
    'http_req_duration{scenario:browse}': ['p(95)<150'],
  },
};

export function browse() {
  const res = http.get(`${BASE}/health`);
  check(res, { 'health 200': (r) => r.status === 200 });
  sleep(Math.random() * 1 + 0.5);
}

export function login() {
  const res = http.post(`${BASE}/api/auth/login`, JSON.stringify({ email: EMAIL, password: PASS }), {
    headers: { 'Content-Type': 'application/json' },
  });
  loginDur.add(res.timings.duration);
  const ok = check(res, { 'login 200': (r) => r.status === 200 });
  loginFail.add(!ok);
  sleep(Math.random() * 2 + 1);
}
