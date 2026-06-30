import { db, passwordResetTokens } from "../../shared/db";
import { eq } from "drizzle-orm";

export interface PasswordResetToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface IPasswordResetRepository {
  createToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  findByToken(token: string): Promise<PasswordResetToken | null>;
  deleteToken(token: string): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
}

export class PasswordResetRepository implements IPasswordResetRepository {
  async createToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await db.insert(passwordResetTokens).values({
      userId,
      token,
      expiresAt,
    });
  }

  async findByToken(token: string): Promise<PasswordResetToken | null> {
    const [tokenRecord] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token))
      .limit(1);

    return tokenRecord || null;
  }

  async deleteToken(token: string): Promise<void> {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));
  }

  async deleteByUserId(userId: string): Promise<void> {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
  }
}
