import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { UserRepository } from "../user/user.repository";
import { config } from "../../shared/config";
import { ForbiddenError, UnauthorizedError } from "../../shared/errors/http-errors";

const userRepository = new UserRepository();

export const authPlugin = new Elysia()
  .use(
    jwt({
      name: "jwt",
      secret: config.jwt.secret,
      schema: t.Object({
        sub: t.String(),
        email: t.String(),
        role: t.String(),
      }),
    })
  )
  .derive({ as: "global" }, async ({ jwt, headers: { authorization } }) => {
    if (!authorization) {
      return { user: null };
    }

    const parts = authorization.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return { user: null };
    }

    const token = parts[1];
    const payload = await jwt.verify(token);
    if (!payload) {
      return { user: null };
    }

    const userId = payload.sub;
    if (!userId) {
      return { user: null };
    }

    // Retrieve user using the repository layer
    const user = await userRepository.findById(userId);
    if (!user) {
      return { user: null };
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  });

export const requireRole = (allowedRoles: ("user" | "pro" | "admin")[]) => {
  return async ({ user }: { user: any }) => {
    if (!user) {
      throw new UnauthorizedError();
    }

    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenError(`Forbidden: Access requires one of the following roles: ${allowedRoles.join(", ")}`);
    }
  };
};
