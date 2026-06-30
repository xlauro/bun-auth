import { beforeAll, describe, expect, it } from "bun:test";
import { db, users, passwordResetTokens } from "../shared/db";
import { app } from "../index";
import { eq } from "drizzle-orm";

// Clean database before running tests
beforeAll(async () => {
  await db.delete(users);
});

// Helper function to handle local HTTP requests in memory
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

describe("Integration Tests - Standard Workflows", () => {
  let userToken = "";
  let proToken = "";
  let adminToken = "";

  describe("GET /health - Health Check & Observability", () => {
    it("should return healthy state from health check endpoint", async () => {
      const res = await testRequest("/health", "GET");
      expect(res.status).toBe(200);
      expect(res.headers.get("x-request-id")).not.toBeNull();
      const data = await res.json();
      expect(data.status).toBe("healthy");
      expect(data).toHaveProperty("uptime");
      expect(data).toHaveProperty("memory");
      expect(data.services.database).toBe("UP");
    });
  });

  describe("POST /auth/register - Validation & Creation", () => {
    it("should reject invalid email format", async () => {
      const res = await testRequest("/auth/register", "POST", {
        email: "plainaddress",
        password: "password123",
        role: "user",
      });
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data).toHaveProperty("type", "validation");
    });

    it("should reject password less than 8 characters", async () => {
      const res = await testRequest("/auth/register", "POST", {
        email: "someone@example.com",
        password: "short",
        role: "user",
      });
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.property).toBe("/password");
    });

    it("should reject invalid role in payload", async () => {
      const res = await testRequest("/auth/register", "POST", {
        email: "someone@example.com",
        password: "password123",
        role: "super-user",
      });
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.property).toBe("/role");
    });

    it("should successfully register a standard 'user' role", async () => {
      const res = await testRequest("/auth/register", "POST", {
        email: "standard-user@test.com",
        password: "securepassword123",
        role: "user",
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.message).toBe("User registered successfully");
      expect(data.user.email).toBe("standard-user@test.com");
      expect(data.user.role).toBe("user");
      expect(data.user).not.toHaveProperty("passwordHash");
    });

    it("should successfully register a 'pro' role", async () => {
      const res = await testRequest("/auth/register", "POST", {
        email: "pro-user@test.com",
        password: "securepassword123",
        role: "pro",
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.user.role).toBe("pro");
    });

    it("should successfully register an 'admin' role", async () => {
      const res = await testRequest("/auth/register", "POST", {
        email: "admin-user@test.com",
        password: "securepassword123",
        role: "admin",
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.user.role).toBe("admin");
    });

    it("should reject registering a duplicate email", async () => {
      const res = await testRequest("/auth/register", "POST", {
        email: "standard-user@test.com",
        password: "securepassword123",
        role: "user",
      });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toBe("Email is already registered");
    });
  });

  describe("POST /auth/login - Credentials & Tokens", () => {
    it("should reject login with non-existent email", async () => {
      const res = await testRequest("/auth/login", "POST", {
        email: "doesnotexist@test.com",
        password: "somepassword",
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("Invalid email or password");
    });

    it("should reject login with wrong password", async () => {
      const res = await testRequest("/auth/login", "POST", {
        email: "standard-user@test.com",
        password: "wrongpassword",
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("Invalid email or password");
    });

    it("should log in user and return JWT", async () => {
      const res = await testRequest("/auth/login", "POST", {
        email: "standard-user@test.com",
        password: "securepassword123",
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe("Login successful");
      expect(data).toHaveProperty("token");
      userToken = data.token;
    });

    it("should log in pro and return JWT", async () => {
      const res = await testRequest("/auth/login", "POST", {
        email: "pro-user@test.com",
        password: "securepassword123",
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("token");
      proToken = data.token;
    });

    it("should log in admin and return JWT", async () => {
      const res = await testRequest("/auth/login", "POST", {
        email: "admin-user@test.com",
        password: "securepassword123",
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("token");
      adminToken = data.token;
    });
  });

  describe("GET /protected/* - Access Permissions (Matrix)", () => {
    describe("Standard User Token Scope", () => {
      it("allows user to access /protected/user", async () => {
        const res = await testRequest("/protected/user", "GET", undefined, userToken);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.message).toContain("user, pro, or admin role verified");
      });

      it("denies user access to /protected/pro (403)", async () => {
        const res = await testRequest("/protected/pro", "GET", undefined, userToken);
        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.error).toContain("Forbidden");
      });

      it("denies user access to /protected/admin (403)", async () => {
        const res = await testRequest("/protected/admin", "GET", undefined, userToken);
        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.error).toContain("Forbidden");
      });
    });

    describe("Pro User Token Scope", () => {
      it("allows pro to access /protected/user", async () => {
        const res = await testRequest("/protected/user", "GET", undefined, proToken);
        expect(res.status).toBe(200);
      });

      it("allows pro to access /protected/pro", async () => {
        const res = await testRequest("/protected/pro", "GET", undefined, proToken);
        expect(res.status).toBe(200);
      });

      it("denies pro access to /protected/admin (403)", async () => {
        const res = await testRequest("/protected/admin", "GET", undefined, proToken);
        expect(res.status).toBe(403);
      });
    });

    describe("Admin User Token Scope", () => {
      it("allows admin to access /protected/user", async () => {
        const res = await testRequest("/protected/user", "GET", undefined, adminToken);
        expect(res.status).toBe(200);
      });

      it("allows admin to access /protected/pro", async () => {
        const res = await testRequest("/protected/pro", "GET", undefined, adminToken);
        expect(res.status).toBe(200);
      });

      it("allows admin to access /protected/admin", async () => {
        const res = await testRequest("/protected/admin", "GET", undefined, adminToken);
        expect(res.status).toBe(200);
      });
    });
  });

  describe("POST /auth/reset-password - Request & Confirm Workflow", () => {
    it("should successfully go through the password reset and login cycle", async () => {
      // 1. Request reset password
      const requestRes = await testRequest("/auth/reset-password/request", "POST", {
        email: "standard-user@test.com",
      });
      expect(requestRes.status).toBe(200);

      // 2. Query token from the database
      const [tokenRecord] = await db
        .select()
        .from(passwordResetTokens)
        .limit(1);

      expect(tokenRecord).toBeDefined();
      expect(tokenRecord.token).toBeDefined();

      // 3. Confirm password reset
      const confirmRes = await testRequest("/auth/reset-password/confirm", "POST", {
        token: tokenRecord.token,
        password: "newsecurepassword123",
      });
      expect(confirmRes.status).toBe(200);

      // 4. Invalidate old token check
      const [expiredCheck] = await db
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.token, tokenRecord.token));
      expect(expiredCheck).toBeUndefined();

      // 5. Attempt login with old password (should fail)
      const oldLoginRes = await testRequest("/auth/login", "POST", {
        email: "standard-user@test.com",
        password: "securepassword123",
      });
      expect(oldLoginRes.status).toBe(401);

      // 6. Attempt login with new password (should succeed)
      const newLoginRes = await testRequest("/auth/login", "POST", {
        email: "standard-user@test.com",
        password: "newsecurepassword123",
      });
      expect(newLoginRes.status).toBe(200);
    });
  });
});
