import { Injectable } from '@angular/core';
import { Query } from 'appwrite';
import axios from 'axios';
import {
  BehaviorSubject,
  Observable,
  forkJoin,
  from,
  map,
  of,
  switchMap,
} from 'rxjs';

import { environment } from 'src/environments/environment';
import { ApiService } from 'src/app/services/api/api.service';
import { AuthService } from 'src/app/services/auth/auth.service';
import { UserService } from 'src/app/services/user/user.service';
import { Room } from 'src/app/models/Room';
import { RoomExtendedInterface } from 'src/app/models/types/roomExtended.interface';
import { User } from 'src/app/models/User';
import { listRoomsResponseInterface } from 'src/app/models/types/responses/listRoomsResponse.interface';

@Injectable({
  providedIn: 'root',
})
export class RoomService {
  rooms: BehaviorSubject<any[]> = new BehaviorSubject<any[]>([]); // TODO: WILL BE DELETED
  cUserId: string; // TODO: WILL BE DELETED

  currentUser$: Observable<User>;

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private userService: UserService
  ) {}

  getRoomById(roomId: string): Observable<RoomExtendedInterface | null> {
    return from(
      this.api.getDocument(environment.appwrite.ROOMS_COLLECTION, roomId)
    ).pipe(
      switchMap((room: Room) => {
        return this.fillRoomWithUserData(room, this.cUserId);
      })
    );
  }

  getRoom(
    currentUserId: string,
    userId: string
  ): Observable<listRoomsResponseInterface | null> {
    // Define queries
    const queries: any[] = [];

    // Query for rooms, user attribute that contain current user and userId
    queries.push(Query.search('users', currentUserId));
    queries.push(Query.search('users', userId));

    return from(
      this.api.listDocuments(environment.appwrite.ROOMS_COLLECTION, queries)
    ).pipe(
      switchMap((response: listRoomsResponseInterface) => {
        if (response.documents.length > 0) {
          const room: Room = response.documents[0];
          return this.fillRoomWithUserData(room, currentUserId).pipe(
            map(
              (
                roomWithUserData: RoomExtendedInterface
              ): listRoomsResponseInterface => {
                return {
                  ...response,
                  documents: [roomWithUserData],
                };
              }
            )
          );
        } else {
          return of(response);
        }
      })
    );
  }

  createRoom(
    currentUserId: string,
    userId: string
  ): Observable<RoomExtendedInterface | null> {
    // Set body
    const body = { to: userId };

    // Set x-appwrite-user-id header
    axios.defaults.headers.common['x-appwrite-user-id'] = currentUserId;

    // Set x-appwrite-jwt header
    return from(
      this.authService.createJWT().then((result) => {
        console.log('result: ', result);
        axios.defaults.headers.common['x-appwrite-jwt'] = result?.jwt;
      })
    ).pipe(
      switchMap(() => {
        // Call the /api/room
        return from(
          axios
            .post(environment.url.CREATE_ROOM_API_URL, body)
            .then((result) => {
              return result.data as Room;
            })
        ).pipe(
          switchMap((room: Room) =>
            this.fillRoomWithUserData(room, currentUserId)
          )
        );
      })
    );
  }

  listRooms(
    currentUserId: string,
    offset?: number
  ): Observable<listRoomsResponseInterface> {
    // Define queries
    const queries: any[] = [];

    // Query for rooms that contain the current user
    queries.push(Query.search('users', currentUserId));

    // Query for rooms descending by $createdAt
    queries.push(Query.orderDesc('$createdAt'));

    // Limit and offset
    queries.push(Query.limit(environment.opts.PAGINATION_LIMIT));
    if (offset) queries.push(Query.offset(offset));

    return from(
      this.api.listDocuments(environment.appwrite.ROOMS_COLLECTION, queries)
    ).pipe(
      switchMap((payload: listRoomsResponseInterface) => {
        if (payload.documents.length > 0) {
          const roomObservables = payload.documents.map((room: Room) =>
            this.fillRoomWithUserData(room, currentUserId)
          );
          return forkJoin(roomObservables).pipe(
            map((rooms) => {
              payload.documents = rooms;
              return payload;
            })
          );
        } else {
          return of(payload);
        }
      })
    );
  }

  //
  // Utils
  //

  private fillRoomWithUserData(
    room: Room, // TODO: it has to be Room model.
    currentUserId: string
  ): Observable<RoomExtendedInterface> {
    let userId: string[] | string = room.users.filter(
      (id) => id != currentUserId
    );
    userId = userId[0];
    if (userId === undefined) {
      room['userData'] = null;
      return of(room as RoomExtendedInterface);
    } else {
      return from(this.userService.getUserDoc(userId)).pipe(
        map((data) => {
          room['userData'] = data as User;
          return room as RoomExtendedInterface;
        })
      );
    }
  }

  //
  // TODO: WILL BE DELETED
  //

  listenRooms() {
    console.log('listenRooms started');
    const client = this.api.client$();
    return client.subscribe(
      'databases.' +
        environment.appwrite.APP_DATABASE +
        '.collections.' +
        environment.appwrite.ROOMS_COLLECTION +
        '.documents',
      (response) => {
        console.log(response);
      }
    );
  }

  // Update rooms behavior subject
  async updateRooms(room) {
    room = await this.fillRoomWithUserData(room, this.cUserId);
    // room = await this.fillRoomWithLastMessage(room);
    const currentRooms = this.rooms.getValue();
    const existingRoom = currentRooms.find((r) => r.$id === room.$id);
    if (existingRoom) {
      // Update the existing room item in the array
      const updatedRooms = currentRooms.map((r) => {
        if (r === existingRoom) {
          return room;
        }
        return r;
      });
      this.rooms.next(updatedRooms);
    } else {
      // Add the new room item to the array
      const newRooms = [...currentRooms, room];
      this.rooms.next(newRooms);
    }
  }
}
