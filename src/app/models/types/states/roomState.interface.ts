import { RoomWithUserData } from 'src/app/models/Room';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { Message } from 'src/app/models/Message';

export interface RoomStateInterface {
  isLoading: boolean;
  rooms: RoomWithUserData[] | null;
  total_rooms: number;
  error_rooms: ErrorInterface | null;
  room: RoomWithUserData | null;
  messages: Message[] | null;
  total_messages: number;
  error_messages: ErrorInterface | null;
}
