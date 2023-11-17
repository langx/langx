import { Message } from 'src/app/models/Message';

export interface listMessagesResponseInterface {
  total: number;
  documents: Message[];
}
