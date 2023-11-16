import { RoomWithUserData } from 'src/app/models/Room';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

export interface RoomsStateInterface {
  isLoading: boolean;
  total: number;
  error: ErrorInterface | null;
  rooms: RoomWithUserData[] | null;
  activeRoom: RoomWithUserData | null;
}
