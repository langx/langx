import { Models } from 'appwrite';

import { Account } from '../../Account';
import { Language } from '../../Language';
import { User } from '../../User';
import { ErrorInterface } from '../errors/error.interface';

export interface AuthStateInterface {
  isLoading: boolean;
  account: Account | null;
  currentUser: User | null;
  isLoggedIn: boolean | null;
  languages: Language[] | null;
  identities: Models.Identity[] | null;
  sessions: Models.Session[] | null;
  isLanguageDone: boolean;
  verifyEmailSuccess: boolean;
  verifyEmailConfirmationSuccess: boolean;
  verifyEmailConfirmationError: ErrorInterface | null; // TODO: Rename it to verifyEmailError
  resetPasswordSuccess: boolean;
  resetPasswordConfirmationSuccess: boolean;
  resetPasswordError: ErrorInterface | null;
  unauthorizedError: ErrorInterface | null;
  registerValidationError: ErrorInterface | null;
  loginValidationError: ErrorInterface | null;
  profileError: ErrorInterface | null;
  presenceError: ErrorInterface | null;
  editProfileError: ErrorInterface | null;
  accountDetailError: ErrorInterface | null;
}
