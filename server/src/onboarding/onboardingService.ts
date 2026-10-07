import type { AuthUser, OnboardingCompletionInput } from '@capstone/shared';
import { AuthRepository } from '../auth/authRepository.js';
import { AppError } from '../errors/AppError.js';
import { OnboardingRepository } from './onboardingRepository.js';

export class OnboardingService {
  constructor(
    private readonly repository = new OnboardingRepository(),
    private readonly authRepository = new AuthRepository(),
  ) {}

  async complete(userId: number, input: OnboardingCompletionInput): Promise<AuthUser> {
    try {
      await this.repository.complete(userId, input);
    } catch (error) {
      if (error instanceof Error && error.message === 'INACCESSIBLE_ONBOARDING_PREFERENCE') {
        throw new AppError(400, 'INVALID_ONBOARDING_PREFERENCES', 'One or more selected items are unavailable. Refresh and try again.');
      }
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') {
        throw new AppError(401, 'AUTH_REQUIRED', 'Please log in.');
      }
      throw error;
    }
    const user = await this.authRepository.findById(userId);
    if (!user) throw new AppError(401, 'AUTH_REQUIRED', 'Please log in.');
    return user;
  }
}
