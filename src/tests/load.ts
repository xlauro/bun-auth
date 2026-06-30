/**
 * Custom Lightweight High-Performance Load Testing Tool
 * Built natively for Bun to measure Throughput (RPS) and Latency Percentiles.
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "15", 10);
const DURATION_SECONDS = parseInt(process.env.DURATION || "5", 10);

interface LatencyStats {
  min: number;
  max: number;
  avg: number;
  p95: number;
  p99: number;
}

interface WorkerStats {
  requests: number;
  success: number;
  failures: number;
  latencies: number[];
  statusCodes: Record<number, number>;
}

// Generates random email for registering new users under load
function generateRandomEmail(): string {
  return `load-user-${Math.random().toString(36).substring(2, 11)}@loadtest.com`;
}

// Print colored console logs
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

function formatLatency(ms: number): string {
  return `${ms.toFixed(2)}ms`;
}

function calculateLatencyStats(latencies: number[]): LatencyStats {
  if (latencies.length === 0) return { min: 0, max: 0, avg: 0, p95: 0, p99: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  
  const p95Idx = Math.floor(sorted.length * 0.95);
  const p99Idx = Math.floor(sorted.length * 0.99);

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / sorted.length,
    p95: sorted[p95Idx] || sorted[sorted.length - 1],
    p99: sorted[p99Idx] || sorted[sorted.length - 1],
  };
}

async function runScenario(scenarioType: "ping" | "auth_flow"): Promise<void> {
  console.log(`\n${colors.bold}${colors.cyan}=== Running Load Test (${scenarioType.toUpperCase()} Scenario) ===${colors.reset}`);
  console.log(`${colors.bold}Target Base URL:${colors.reset} ${BASE_URL}`);
  console.log(`${colors.bold}Concurrency:${colors.reset}     ${CONCURRENCY} concurrent workers`);
  console.log(`${colors.bold}Duration:${colors.reset}        ${DURATION_SECONDS} seconds\n`);

  const globalStats: WorkerStats = {
    requests: 0,
    success: 0,
    failures: 0,
    latencies: [],
    statusCodes: {},
  };

  let testActive = true;

  // Track status code counts safely
  function recordResult(status: number, latency: number) {
    globalStats.requests++;
    if (status >= 200 && status < 300) {
      globalStats.success++;
    } else {
      globalStats.failures++;
    }
    globalStats.latencies.push(latency);
    globalStats.statusCodes[status] = (globalStats.statusCodes[status] || 0) + 1;
  }

  // Create a single worker loop
  async function worker() {
    while (testActive) {
      const email = generateRandomEmail();
      const password = "loadtestPassword123";

      if (scenarioType === "ping") {
        const start = performance.now();
        try {
          const res = await fetch(`${BASE_URL}/`);
          const elapsed = performance.now() - start;
          recordResult(res.status, elapsed);
          // Drain body to release socket back to connection pool
          await res.text();
        } catch (err) {
          globalStats.failures++;
          globalStats.requests++;
        }
      } else if (scenarioType === "auth_flow") {
        // Complete workflow: Register -> Login -> Fetch Protected Resource
        const start = performance.now();
        try {
          // 1. Register User
          const regRes = await fetch(`${BASE_URL}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, role: "user" }),
          });
          
          if (regRes.status !== 201) {
            recordResult(regRes.status, performance.now() - start);
            await regRes.text();
            continue;
          }
          await regRes.text();

          // 2. Login User
          const loginRes = await fetch(`${BASE_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });

          if (loginRes.status !== 200) {
            recordResult(loginRes.status, performance.now() - start);
            await loginRes.text();
            continue;
          }
          
          const loginData: any = await loginRes.json();
          const token = loginData.token;

          // 3. Access Protected Route
          const protRes = await fetch(`${BASE_URL}/protected/user`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}` },
          });

          await protRes.text();
          const elapsed = performance.now() - start;
          recordResult(protRes.status, elapsed);

        } catch (err) {
          globalStats.failures++;
          globalStats.requests++;
        }
      }
    }
  }

  // Spawn concurrency workers
  const startTime = performance.now();
  const workerPromises = Array.from({ length: CONCURRENCY }, () => worker());

  // Wait for the duration of the test
  await new Promise((resolve) => setTimeout(resolve, DURATION_SECONDS * 1000));
  testActive = false;

  // Let workers complete their current request
  await Promise.all(workerPromises);
  const totalDuration = (performance.now() - startTime) / 1000;

  // Calculate stats
  const rps = globalStats.requests / totalDuration;
  const latStats = calculateLatencyStats(globalStats.latencies);

  // Print results
  console.log(`${colors.bold}${colors.green}--- Load Test Summary ---${colors.reset}`);
  console.log(`Total Duration:      ${totalDuration.toFixed(2)}s`);
  console.log(`Total Requests:      ${globalStats.requests}`);
  console.log(`Throughput (RPS):    ${colors.bold}${rps.toFixed(2)} req/sec${colors.reset}`);
  console.log(`Success Rate:        ${colors.green}${((globalStats.success / globalStats.requests) * 100).toFixed(2)}% (${globalStats.success})${colors.reset}`);
  console.log(`Failure Rate:        ${colors.red}${((globalStats.failures / globalStats.requests) * 100).toFixed(2)}% (${globalStats.failures})${colors.reset}`);
  
  console.log(`\n${colors.bold}${colors.yellow}--- Latency Metrics ---${colors.reset}`);
  console.log(`Min Latency:         ${formatLatency(latStats.min)}`);
  console.log(`Average Latency:     ${formatLatency(latStats.avg)}`);
  console.log(`Max Latency:         ${formatLatency(latStats.max)}`);
  console.log(`p95 Percentile:      ${colors.bold}${formatLatency(latStats.p95)}${colors.reset} (95% requests faster than this)`);
  console.log(`p99 Percentile:      ${colors.bold}${formatLatency(latStats.p99)}${colors.reset} (99% requests faster than this)`);

  console.log(`\n${colors.bold}${colors.blue}--- HTTP Status Codes ---${colors.reset}`);
  for (const [code, count] of Object.entries(globalStats.statusCodes)) {
    const color = code.startsWith("2") ? colors.green : colors.red;
    console.log(`Status ${color}${code}${colors.reset}: ${count} times`);
  }
  console.log(`\n${colors.cyan}=============================================${colors.reset}\n`);
}

async function main() {
  console.log("Starting Benchmark Suite...");
  
  // Clean DB pre-run if scenario runs auth flow
  // 1. High throughput check of ping route (GET /)
  await runScenario("ping");

  // 2. Full journey user workflow (heavy DB writes, password bcrypt checks, middleware checks)
  await runScenario("auth_flow");
}

main().catch(console.error);
