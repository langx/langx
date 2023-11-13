import { Message } from '../../Message';

export interface getMessagesResponseInterface {
  total: number;
  documents: Message[];
}
