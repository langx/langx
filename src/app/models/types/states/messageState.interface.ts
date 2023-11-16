import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { Message } from 'src/app/models/Message';
import { User } from 'src/app/models/User';

export interface MessageStateInterface {
  isLoading: boolean;
  messages: Message[] | null;
  userData: User | null;
  total: number;
  error: ErrorInterface | null;
}
