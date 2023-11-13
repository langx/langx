import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { Message } from 'src/app/models/Message';

export interface MessageStateInterface {
  isLoading: boolean;
  messages: Message[] | null;
  total: number;
  error: ErrorInterface | null;
}
