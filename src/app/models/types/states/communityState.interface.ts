import { User } from '../../User';
import { ErrorInterface } from '../errors/error.interface';

export interface CommunityStateInterface {
  isLoading: boolean;
  users: User[] | null;
  error: ErrorInterface | null;
}
