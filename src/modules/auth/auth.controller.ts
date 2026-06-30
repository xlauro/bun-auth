import { Elysia, t } from "elysia";
import { authPlugin } from "./auth.middleware";
import { UserRepository } from "../user/user.repository";
import { PasswordService } from "./password.service";
import { AuthService } from "./auth.service";
import { PasswordResetRepository } from "./password-reset.repository";
import { ConsoleEmailService } from "../email/email.service";

export const authController = new Elysia({ prefix: "/auth" })
  .use(authPlugin)
  .post(
    "/register",
    async ({ body, jwt, set }) => {
      const tokenService = {
        sign: async (payload: any) => jwt.sign(payload),
      };

      const authService = new AuthService(
        new UserRepository(),
        new PasswordService(),
        tokenService,
        new PasswordResetRepository(),
        new ConsoleEmailService()
      );

      const user = await authService.register(body);

      set.status = 201;
      return {
        message: "User registered successfully",
        user,
      };
    },
    {
      body: t.Object({
        email: t.String({
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
          maxLength: 255,
        }),
        password: t.String({
          minLength: 8,
          maxLength: 255,
        }),
        role: t.Union([t.Literal("user"), t.Literal("pro"), t.Literal("admin")], {
          default: "user",
        }),
      }),
      detail: {
        summary: "Register a new user",
        description: "Creates a new user. Validates email format, password length, and checks for unique email.",
      },
    }
  )
  .post(
    "/login",
    async ({ body, jwt }) => {
      const tokenService = {
        sign: async (payload: any) => jwt.sign(payload),
      };

      const authService = new AuthService(
        new UserRepository(),
        new PasswordService(),
        tokenService,
        new PasswordResetRepository(),
        new ConsoleEmailService()
      );

      const result = await authService.login(body.email, body.password);

      return {
        message: "Login successful",
        token: result.token,
        user: result.user,
      };
    },
    {
      body: t.Object({
        email: t.String({
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
          maxLength: 255,
        }),
        password: t.String({
          maxLength: 255,
        }),
      }),
      detail: {
        summary: "User login",
        description: "Logs in a user and returns a signed JWT token.",
      },
    }
  )
  .post(
    "/reset-password/request",
    async ({ body, jwt }) => {
      const tokenService = {
        sign: async (payload: any) => jwt.sign(payload),
      };

      const authService = new AuthService(
        new UserRepository(),
        new PasswordService(),
        tokenService,
        new PasswordResetRepository(),
        new ConsoleEmailService()
      );

      await authService.requestPasswordReset(body.email);

      return {
        message: "If the email is registered, a password reset link has been sent",
      };
    },
    {
      body: t.Object({
        email: t.String({
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
          maxLength: 255,
        }),
      }),
      detail: {
        summary: "Request password reset",
        description: "Sends an email link to reset the password.",
      },
    }
  )
  .post(
    "/reset-password/confirm",
    async ({ body, jwt }) => {
      const tokenService = {
        sign: async (payload: any) => jwt.sign(payload),
      };

      const authService = new AuthService(
        new UserRepository(),
        new PasswordService(),
        tokenService,
        new PasswordResetRepository(),
        new ConsoleEmailService()
      );

      await authService.confirmPasswordReset(body.token, body.password);

      return {
        message: "Password has been reset successfully",
      };
    },
    {
      body: t.Object({
        token: t.String({
          maxLength: 255,
        }),
        password: t.String({
          minLength: 8,
          maxLength: 255,
        }),
      }),
      detail: {
        summary: "Confirm password reset",
        description: "Resets the user's password using a valid token.",
      },
    }
  );
