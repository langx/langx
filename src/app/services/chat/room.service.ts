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
import { Room, RoomWithUserData } from 'src/app/models/Room';
import { User } from 'src/app/models/User';
import { getRoomsResponseInterface } from 'src/app/models/types/responses/getRoomsResponse.interface';

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

  getRoomById(roomId: string): Observable<RoomWithUserData | null> {
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
  ): Observable<getRoomsResponseInterface | null> {
    // Define queries
    const queries: any[] = [];

    // Query for rooms, user attribute that contain current user and userId
    queries.push(Query.search('users', currentUserId));
    queries.push(Query.search('users', userId));

    return from(
      this.api.listDocuments(environment.appwrite.ROOMS_COLLECTION, queries)
    ).pipe(
      switchMap((response: getRoomsResponseInterface) => {
        if (response.documents.length > 0) {
          const room: Room = response.documents[0];
          return this.fillRoomWithUserData(room, currentUserId).pipe(
            map(
              (
                roomWithUserData: RoomWithUserData
              ): getRoomsResponseInterface => {
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
  ): Observable<RoomWithUserData | null> {
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
  ): Observable<getRoomsResponseInterface> {
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
      switchMap((payload: getRoomsResponseInterface) => {
        const roomObservables = payload.documents.map((room: Room) =>
          this.fillRoomWithUserData(room, currentUserId)
        );
        return forkJoin(roomObservables).pipe(
          map((rooms) => {
            payload.documents = rooms
              .map((room) => this.fillRoomWithLastMessage(room))
              .sort((a, b) => {
                let aDate = a.lastMessage
                  ? a.lastMessage.$createdAt
                  : a.$createdAt;
                let bDate = b.lastMessage
                  ? b.lastMessage.$createdAt
                  : b.$createdAt;

                return aDate < bDate ? 1 : -1;
              });
            return payload;
          })
        );
      })
    );
  }

  //
  // Utils
  //

  private fillRoomWithUserData(
    room: Room, // TODO: it has to be Room model.
    currentUserId: string
  ): Observable<RoomWithUserData> {
    let userId: string[] | string = room.users.filter(
      (id) => id != currentUserId
    );
    userId = userId[0];
    if (userId === undefined) {
      room['userData'] = null;
      return of(room as RoomWithUserData);
    } else {
      return from(this.userService.getUserDoc(userId)).pipe(
        map((data) => {
          room['userData'] = data as User;
          return room as RoomWithUserData;
        })
      );
    }
  }

  private fillRoomWithLastMessage(room: RoomWithUserData): RoomWithUserData {
    const lastMessage = room?.messages[room?.messages.length - 1];
    room.lastMessage = lastMessage;
    return room;
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
    room = await this.fillRoomWithLastMessage(room);
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
