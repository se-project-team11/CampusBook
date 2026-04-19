/**
 * k6 load test: concurrent booking conflict prevention.
 *
 * NFR: Zero double-bookings under 50 concurrent requests.
 * Target: booking confirmation latency p95 < 200ms.
 *
 * Prerequisites:
 *   1. docker-compose up -d
 *   2. export TEST_JWT=<student token>
 *      (generate: docker-compose exec api python -c "
 *        import uuid; from app.auth.middleware import create_dev_token;
 *        print(create_dev_token(uuid.uuid4(), 'ROLE_STUDENT', 'test@campus.edu'))")
 *   3. export TEST_RESOURCE_ID=<uuid from seed data>
 *
 * Run:
 *   k6 run \
 *     --env TOKEN=$TEST_JWT \
 *     --env RESOURCE_ID=$TEST_RESOURCE_ID \
 *     tests/load/k6_concurrent_booking.js
 *
 * After run, verify in DB:
 *   SELECT COUNT(*) FROM bookings
 *   WHERE resource_id = '<RESOURCE_ID>'
 *     AND slot_start = '2026-06-01 09:00:00+00'
 *     AND state NOT IN ('RELEASED', 'NO_SHOW');
 *   -- Must return 1
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

// ── Custom metrics ──────────────────────────────────────────────────────────
const successCount = new Counter("booking_success_201");
const conflictCount = new Counter("booking_conflict_409");
const bookingLatency = new Trend("booking_latency_ms", true);

// ── Test configuration ──────────────────────────────────────────────────────
export const options = {
    scenarios: {
        concurrent_booking: {
            executor: "shared-iterations",
            vus: 50,     // 50 virtual users
            iterations: 50,     // 50 total requests (1 per VU)
            maxDuration: "30s",
        },
    },
    thresholds: {
        // NFR: booking latency p95 < 200ms
        booking_latency_ms: ["p(95)<200"],
        // NFR: no 5xx errors
        http_req_failed: ["rate<0.01"],
    },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:8000";
const TOKEN = __ENV.TOKEN;
const RESOURCE_ID = __ENV.RESOURCE_ID;

// Use a fixed future slot — all 50 VUs race for the same slot
const SLOT_START = "2026-06-01T09:00:00Z";
const SLOT_END = "2026-06-01T10:00:00Z";

export default function () {
    const startTime = Date.now();

    const res = http.post(
        `${BASE_URL}/api/bookings/`,
        JSON.stringify({
            resource_id: RESOURCE_ID,
            slot_start: SLOT_START,
            slot_end: SLOT_END,
            notes: "k6 load test",
        }),
        {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${TOKEN}`,
            },
            timeout: "10s",
        }
    );

    const latencyMs = Date.now() - startTime;
    bookingLatency.add(latencyMs);

    check(res, {
        "status is 201 or 409": (r) => r.status === 201 || r.status === 409,
        "no server errors (5xx)": (r) => r.status < 500,
    });

    if (res.status === 201) {
        successCount.add(1);
        console.log(`SUCCESS: booking_id=${JSON.parse(res.body).booking_id}, latency=${latencyMs}ms`);
    } else if (res.status === 409) {
        conflictCount.add(1);
    } else {
        console.error(`UNEXPECTED: status=${res.status}, body=${res.body}`);
    }
}

export function handleSummary(data) {
    const successes = data.metrics.booking_success_201?.values?.count ?? 0;
    const conflicts = data.metrics.booking_conflict_409?.values?.count ?? 0;
    const p95 = data.metrics.booking_latency_ms?.values?.["p(95)"] ?? "N/A";

    console.log("\n══════════════════════════════════════════════");
    console.log("  CampusBook — Concurrent Booking Load Test");
    console.log("══════════════════════════════════════════════");
    console.log(`  Successful bookings (201):  ${successes}`);
    console.log(`  Conflict rejections (409):  ${conflicts}`);
    console.log(`  Booking latency p95:        ${p95}ms`);
    console.log(`  NFR target p95:             < 200ms`);
    console.log("══════════════════════════════════════════════");

    if (successes !== 1) {
        console.error(
            `\n⚠️  FAIL: Expected exactly 1 successful booking, got ${successes}.`
        );
        console.error("   Pessimistic locking may not be effective!");
    } else {
        console.log("\n✅  PASS: Exactly 1 booking succeeded. Zero double-bookings confirmed.");
    }

    return {};
}
