export interface IEmailService {
  sendPasswordResetEmail(email: string, resetLink: string): Promise<void>;
}

export class ConsoleEmailService implements IEmailService {
  async sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
    console.log("=========================================");
    console.log(`✉️ EMAIL SENT TO: ${email}`);
    console.log("SUBJECT: Password Reset Request");
    console.log("BODY: You requested a password reset. Please use the link below to set a new password:");
    console.log(`${resetLink}`);
    console.log("=========================================");
  }
}
