import { User } from '../../User';
import { ErrorInterface } from '../errors/error.interface';

export interface CommunityStateInterface {
  isLoading: boolean;
  total: number;
  users: User[] | null;
  error: ErrorInterface | null;
}
