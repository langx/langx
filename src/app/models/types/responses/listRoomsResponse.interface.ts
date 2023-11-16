import { RoomExtendedInterface } from 'src/app/models/types/roomExtended.interface';
//import { Room } from 'src/app/models/Room';

export interface listRoomsResponseInterface {
  total: number;
  documents: RoomExtendedInterface[];
}
