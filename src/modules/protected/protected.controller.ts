import { Elysia } from "elysia";
import { authPlugin, requireRole } from "../auth/auth.middleware";

export const protectedController = new Elysia({ prefix: "/protected" })
  .use(authPlugin)
  .get(
    "/user",
    ({ user }) => {
      return {
        message: "Access granted: user, pro, or admin role verified.",
        user,
      };
    },
    {
      beforeHandle: [requireRole(["user", "pro", "admin"])],
      detail: {
        summary: "User protected route",
        description: "Accessible by user, pro, and admin roles.",
      },
    }
  )
  .get(
    "/pro",
    ({ user }) => {
      return {
        message: "Access granted: pro or admin role verified.",
        user,
      };
    },
    {
      beforeHandle: [requireRole(["pro", "admin"])],
      detail: {
        summary: "Pro protected route",
        description: "Accessible by pro and admin roles.",
      },
    }
  )
  .get(
    "/admin",
    ({ user }) => {
      return {
        message: "Access granted: admin role verified.",
        user,
      };
    },
    {
      beforeHandle: [requireRole(["admin"])],
      detail: {
        summary: "Admin protected route",
        description: "Accessible only by admin role.",
      },
    }
  );
