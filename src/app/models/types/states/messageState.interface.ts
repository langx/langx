import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { Message } from 'src/app/models/Message';
import { User } from 'src/app/models/User';
import { RoomExtendedInterface } from '../roomExtended.interface';

export interface MessageStateInterface {
  isLoading: boolean;
  room: RoomExtendedInterface | null;
  error: ErrorInterface | null;
}
