import { User } from 'src/app/models/User';
import { Account } from 'src/app/models/Account';

export interface isLoggedInResponseInterface {
  account: Account;
  currentUser: User;
}
