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
  isLanguageDone: boolean;
  unauthorizedError: ErrorInterface | null;
  registerValidationError: ErrorInterface | null;
  loginValidationError: ErrorInterface | null;
  profileError: ErrorInterface | null;
  presenceError: ErrorInterface | null;
  editProfileError: ErrorInterface | null;
}
