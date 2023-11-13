import { Room, RoomWithUserData } from 'src/app/models/Room';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

export interface RoomStateInterface {
  isLoading: boolean;
  room: Room | null;
  rooms: RoomWithUserData[] | null;
  total: number;
  error: ErrorInterface | null;
}
