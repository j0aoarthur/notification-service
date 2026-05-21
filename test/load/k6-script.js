import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    constant_request_rate: {
      executor: 'constant-arrival-rate',
      rate: 1000,
      timeUnit: '1m', // 1000 iterations per minute, ~16.67 RPS
      duration: '1m',
      preAllocatedVUs: 20, // Initial pool of VUs
      maxVUs: 50, // Max pool of VUs
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'], // http errors should be less than 1%
    http_req_duration: ['p(95)<200'], // 95% of requests should be below 200ms
  },
};

export default function () {
  const url = 'http://localhost:3000/notifications';
  const payload = JSON.stringify({
    templateId: 'test_template',
    channel: 'EMAIL',
    recipient: 'load-test@example.com',
    variables: {
      name: 'Load Tester'
    }
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(url, payload, params);
  check(res, {
    'is status 202': (r) => r.status === 202,
  });
}
