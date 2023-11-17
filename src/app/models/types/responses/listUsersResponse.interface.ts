import { User } from 'src/app/models/User';

export interface listUsersResponseInterface {
  total: number;
  documents: User[];
}
