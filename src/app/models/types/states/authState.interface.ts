import { Account } from '../../Account';
import { ErrorInterface } from '../errors/error.interface';

export interface AuthStateInterface {
  isLoading: boolean;
  currentUser: Account | null;
  isLoggedIn: boolean | null;
  validationError: ErrorInterface | null;
}
