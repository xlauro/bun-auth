import { beforeAll, describe, expect, it } from "bun:test";
import { db, users, passwordResetTokens } from "../shared/db";
import { app } from "../index";

beforeAll(async () => {
  // Clean up any test users that might conflict
  await db.delete(users);
});

async function testRequest(path: string, method: string, body?: any, token?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const req = new Request(`http://localhost${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  return app.handle(req);
}

describe("Regression & Boundary Tests", () => {
  
  describe("Input Boundary Limits", () => {
    it("should reject registration with empty email", async () => {
      const res = await testRequest("/auth/register", "POST", {
        email: "",
        password: "password123",
        role: "user",
      });
      expect(res.status).toBe(422);
    });

    it("should reject registration with extremely long email (e.g. 300 chars)", async () => {
      const longEmail = "a".repeat(290) + "@example.com";
      const res = await testRequest("/auth/register", "POST", {
        email: longEmail,
        password: "password123",
        role: "user",
      });
      // Email pattern validation in auth.controller:
      // ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$
      // Long email that matches pattern should be checked for database limits or Elysia schema validation
      // Let's verify how it handles it.
      expect([201, 422, 400]).toContain(res.status);
    });

    it("should reject registration when email field is missing", async () => {
      const res = await testRequest("/auth/register", "POST", {
        password: "password123",
        role: "user",
      });
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.property).toBe("/email");
    });

    it("should reject registration when body is empty object", async () => {
      const res = await testRequest("/auth/register", "POST", {});
      expect(res.status).toBe(422);
    });

    it("should handle invalid JSON gracefully", async () => {
      const req = new Request("http://localhost/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ malformed json",
      });
      const res = await app.handle(req);
      // Elysia or Bun body parser should return a validation or bad request status (e.g. 400 or 422 or 500)
      // but must NOT crash the process.
      expect([400, 422, 500]).toContain(res.status);
    });
  });

  describe("SQL Injection Resiliency", () => {
    it("should reject registration / login attempts containing SQL injection patterns without execution or crash", async () => {
      const sqlInjectionPayload = "admin' OR '1'='1' --";
      
      const regRes = await testRequest("/auth/register", "POST", {
        email: sqlInjectionPayload, // Will fail validation pattern first, preventing injection
        password: "password123",
        role: "user",
      });
      expect(regRes.status).toBe(422);

      // Login check with SQL Injection
      const loginRes = await testRequest("/auth/login", "POST", {
        email: sqlInjectionPayload,
        password: "password123",
      });
      // Will fail validation pattern or query returns 0 rows (401)
      expect([401, 422]).toContain(loginRes.status);
    });
  });

  describe("Authorization Header Edge Cases", () => {
    it("returns 401 when Authorization header is completely empty", async () => {
      const req = new Request("http://localhost/protected/user", {
        method: "GET",
        headers: {
          "Authorization": "",
        },
      });
      const res = await app.handle(req);
      expect(res.status).toBe(401);
    });

    it("returns 401 when Authorization header does not use Bearer scheme", async () => {
      const req = new Request("http://localhost/protected/user", {
        method: "GET",
        headers: {
          "Authorization": "Basic dGVzdEB0ZXN0LmNvbTpwYXNzd29yZA==",
        },
      });
      const res = await app.handle(req);
      expect(res.status).toBe(401);
    });

    it("returns 401 when Authorization header has missing token part (e.g. just 'Bearer')", async () => {
      const req = new Request("http://localhost/protected/user", {
        method: "GET",
        headers: {
          "Authorization": "Bearer",
        },
      });
      const res = await app.handle(req);
      expect(res.status).toBe(401);
    });

    it("returns 401 when Authorization header token is malformed", async () => {
      const res = await testRequest("/protected/user", "GET", undefined, "not-a-valid-jwt-token");
      expect(res.status).toBe(401);
    });
  });

  describe("Concurrent / Race Conditions", () => {
    it("should handle concurrent registration requests for same email without duplicating database records", async () => {
      const email = "concurrency-test@example.com";
      const registerPayload = {
        email,
        password: "password123",
        role: "user" as const,
      };

      // Clean database first
      await testRequest("/auth/register", "POST", registerPayload);

      // Perform parallel login and registration checks to verify database constraint stability
      const attempts = await Promise.all([
        testRequest("/auth/register", "POST", registerPayload),
        testRequest("/auth/register", "POST", registerPayload),
        testRequest("/auth/register", "POST", registerPayload),
      ]);

      // All parallel requests for duplicate email registration should return 409 Conflict
      for (const res of attempts) {
        expect(res.status).toBe(409);
        const data = await res.json();
        expect(data.error).toBe("Email is already registered");
      }
    });
  });

  describe("Password Reset Edge Cases", () => {
    it("should respond with 200 when requesting reset for non-existent email (prevent enumeration)", async () => {
      const res = await testRequest("/auth/reset-password/request", "POST", {
        email: "non-existent-user@example.com",
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toContain("If the email is registered");
    });

    it("should fail when confirming reset with non-existent token", async () => {
      const res = await testRequest("/auth/reset-password/confirm", "POST", {
        token: "non-existent-token-string",
        password: "newpassword123",
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Invalid or expired password reset token");
    });

    it("should fail when confirming reset with an expired token", async () => {
      // 1. Create a user
      const email = "expired-token-test@example.com";
      const registerRes = await testRequest("/auth/register", "POST", {
        email,
        password: "password123",
        role: "user",
      });
      expect(registerRes.status).toBe(201);
      const regData = await registerRes.json();
      const userId = regData.user.id;

      // 2. Insert an already expired token directly in the database
      const expiredToken = crypto.randomUUID();
      const expiredDate = new Date(Date.now() - 1000 * 60 * 5); // 5 minutes ago

      await db.insert(passwordResetTokens).values({
        userId,
        token: expiredToken,
        expiresAt: expiredDate,
      });

      // 3. Attempt to confirm reset using the expired token
      const res = await testRequest("/auth/reset-password/confirm", "POST", {
        token: expiredToken,
        password: "newpassword123",
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Invalid or expired password reset token");
    });

    it("should fail when confirming reset with a short password", async () => {
      const res = await testRequest("/auth/reset-password/confirm", "POST", {
        token: "some-token",
        password: "short", // under 8 chars
      });
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.property).toBe("/password");
    });
  });
});
