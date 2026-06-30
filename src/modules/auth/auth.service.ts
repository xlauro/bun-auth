import { IUserRepository, User } from "../user/user.repository";
import { IPasswordService } from "./password.service";
import { IPasswordResetRepository } from "./password-reset.repository";
import { IEmailService } from "../email/email.service";
import { ConflictError, UnauthorizedError, HttpError } from "../../shared/errors/http-errors";

export interface ITokenService {
  sign(payload: { sub: string; email: string; role: string }): Promise<string>;
}

export class AuthService {
  constructor(
    private userRepository: IUserRepository,
    private passwordService: IPasswordService,
    private tokenService: ITokenService,
    private passwordResetRepository: IPasswordResetRepository,
    private emailService: IEmailService
  ) {}

  async register(data: {
    email: string;
    password: string;
    role: "user" | "pro" | "admin";
  }): Promise<Omit<User, "passwordHash">> {
    const existing = await this.userRepository.findByEmail(data.email);
    if (existing) {
      throw new ConflictError("Email is already registered");
    }

    const passwordHash = await this.passwordService.hash(data.password);
    const user = await this.userRepository.create({
      email: data.email,
      passwordHash,
      role: data.role,
    });

    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async login(email: string, password: string): Promise<{ token: string; user: Omit<User, "passwordHash"> }> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const isPasswordValid = await this.passwordService.verify(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const token = await this.tokenService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const { passwordHash: _, ...userWithoutPassword } = user;
    return { token, user: userWithoutPassword };
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      // Return early with generic message to prevent user enumeration
      return;
    }

    // Invalidate old tokens for this user
    await this.passwordResetRepository.deleteByUserId(user.id);

    // Generate secure token and expiry (15 mins)
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.passwordResetRepository.createToken(user.id, token, expiresAt);

    // Send email with reset link
    const resetLink = `http://localhost:3000/auth/reset-password/confirm?token=${token}`;
    await this.emailService.sendPasswordResetEmail(email, resetLink);
  }

  async confirmPasswordReset(tokenString: string, newPassword: string): Promise<void> {
    const resetToken = await this.passwordResetRepository.findByToken(tokenString);
    if (!resetToken) {
      throw new HttpError("Invalid or expired password reset token", 400);
    }

    if (resetToken.expiresAt < new Date()) {
      // Invalidate expired token
      await this.passwordResetRepository.deleteToken(tokenString);
      throw new HttpError("Invalid or expired password reset token", 400);
    }

    // Hash and update password
    const passwordHash = await this.passwordService.hash(newPassword);
    await this.userRepository.updatePassword(resetToken.userId, passwordHash);

    // Delete token after successful use
    await this.passwordResetRepository.deleteToken(tokenString);
  }
}
