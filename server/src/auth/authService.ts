import { compare, hash } from 'bcryptjs';
import type { AuthUser } from '@capstone/shared';
import { AppError } from '../errors/AppError.js';
import { AuthRepository } from './authRepository.js';

export class AuthService {
  constructor(private readonly repository = new AuthRepository()) {}

  async register(username: string, password: string): Promise<AuthUser> {
    if (await this.repository.findByUsername(username)) {
      throw new AppError(409, 'USERNAME_TAKEN', 'That username is already in use.');
    }
    const passwordHash = await hash(password, 12);
    try {
      return await this.repository.create(username, passwordHash);
    } catch (error: unknown) {
      if (isDuplicateEntry(error)) throw new AppError(409, 'USERNAME_TAKEN', 'That username is already in use.');
      throw error;
    }
  }

  async login(username: string, password: string): Promise<AuthUser> {
    const user = await this.repository.findByUsername(username);
    if (!user || !(await compare(password, user.passwordHash))) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Username or password is incorrect.');
    }
    return { id: user.id, username: user.username };
  }

  async currentUser(id: number): Promise<AuthUser> {
    const user = await this.repository.findById(id);
    if (!user) throw new AppError(401, 'AUTH_REQUIRED', 'Please log in.');
    return user;
  }
}

function isDuplicateEntry(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY';
}
