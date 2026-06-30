export interface IPasswordService {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

export class PasswordService implements IPasswordService {
  async hash(password: string): Promise<string> {
    return Bun.password.hash(password);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return Bun.password.verify(password, hash);
  }
}
