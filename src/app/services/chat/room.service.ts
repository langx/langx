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

  getRoom2(
    currentUserId: string,
    userId: string
  ): Observable<getRoomsResponseInterface | null> {
    return from(
      this.api.listDocuments(environment.appwrite.ROOMS_COLLECTION, [
        Query.search('users', currentUserId),
        Query.search('users', userId),
      ])
    );
  }

  // TODO: WILL BE DELETED
  getRoom(roomId: string): Promise<any> {
    return this.api.getDocument(environment.appwrite.ROOMS_COLLECTION, roomId);
  }

  createRoom(currentUserId: string, userId: string): Observable<Room | null> {
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
        );
      })
    );
  }

  listRooms(currentUserId: string): Observable<getRoomsResponseInterface> {
    return from(
      this.api.listDocuments(environment.appwrite.ROOMS_COLLECTION, [
        Query.search('users', currentUserId),
        Query.orderDesc('$createdAt'),
      ])
    ).pipe(
      switchMap((payload: getRoomsResponseInterface) => {
        const roomObservables = payload.documents.map(
          (room: RoomWithUserData) =>
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

  fillRoomWithUserData(
    room: RoomWithUserData,
    currentUserId: string
  ): Observable<RoomWithUserData> {
    let userId: string[] | string = room.users.filter(
      (id) => id != currentUserId
    );
    userId = userId[0];
    if (userId === undefined) {
      room.userData = null;
      return of(room);
    } else {
      return from(this.userService.getUserDoc(userId)).pipe(
        map((data) => {
          room.userData = data as User;
          return room;
        })
      );
    }
  }

  fillRoomWithLastMessage(room: RoomWithUserData): RoomWithUserData {
    const lastMessage = room?.messages[room?.messages.length - 1];
    room.lastMessage = lastMessage;
    return room;
  }

  // TODO: WILL BE DELETED
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

  // TODO: WILL BE DELETED
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
