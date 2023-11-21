import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { Message } from 'src/app/models/Message';
import { User } from 'src/app/models/User';
import { RoomExtendedInterface } from '../roomExtended.interface';
import { createMessageRequestInterface } from '../requests/createMessageRequest.interface';

export interface MessageStateInterface {
  isLoading: boolean;
  isLoading_offset: boolean;
  tempMessage: createMessageRequestInterface | null;
  room: RoomExtendedInterface | null;
  error: ErrorInterface | null;
}
