import { RoomWithUserData } from 'src/app/models/Room';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

export interface RoomsStateInterface {
  isLoading: boolean;
  room: RoomWithUserData | null;
  rooms: RoomWithUserData[] | null;
  total: number;
  error: ErrorInterface | null;
}
