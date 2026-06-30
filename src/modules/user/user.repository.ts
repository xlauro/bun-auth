import { db, users } from "../../shared/db";
import { eq } from "drizzle-orm";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: "user" | "pro" | "admin";
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(data: { email: string; passwordHash: string; role: "user" | "pro" | "admin" }): Promise<User>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
}

export class UserRepository implements IUserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user || null;
  }

  async findById(id: string): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user || null;
  }

  async create(data: { email: string; passwordHash: string; role: "user" | "pro" | "admin" }): Promise<User> {
    const [newUser] = await db
      .insert(users)
      .values(data)
      .returning();

    return newUser;
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, id));
  }
}
