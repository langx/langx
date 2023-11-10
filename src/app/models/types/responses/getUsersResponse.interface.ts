import { User } from 'src/app/models/User';

export interface getUsersResponseInterface {
  total: number;
  documents: User[];
}
