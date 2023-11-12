import { RoomWithUserData } from 'src/app/models/Room';

export interface getRoomsResponseInterface {
  total: number;
  documents: RoomWithUserData[];
}
