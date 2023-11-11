import { Room } from 'src/app/models/Room';

export interface getRoomsResponseInterface {
  total: number;
  documents: Room[];
}
