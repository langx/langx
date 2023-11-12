import { Injectable } from '@angular/core';
import { Query } from 'appwrite';
import { BehaviorSubject, Observable, from, switchMap } from 'rxjs';
import axios from 'axios';

import { environment } from 'src/environments/environment';
import { ApiService } from 'src/app/services/api/api.service';
import { AuthService } from 'src/app/services/auth/auth.service';
import { UserService } from 'src/app/services/user/user.service';
import { Room } from 'src/app/models/Room';
import { User } from 'src/app/models/User';
import { getRoomsResponseInterface } from 'src/app/models/types/responses/getRoomsResponse.interface';

@Injectable({
  providedIn: 'root',
})
export class RoomService {
  rooms: BehaviorSubject<any[]> = new BehaviorSubject<any[]>([]);
  cUserId: string;

  currentUser$: Observable<User>;

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private userService: UserService
  ) {}

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

  createRoom2(currentUserId: string, userId: string): Observable<Room | null> {
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

  async checkRoom(userId: string): Promise<any> {
    let cUserId = this.authService.getUserId();
    console.log('checkRoom: ', cUserId, userId);

    const promise = this.api.listDocuments(
      environment.appwrite.ROOMS_COLLECTION,
      [Query.search('users', cUserId), Query.search('users', userId)]
    );

    return promise.then((values) => {
      console.log('result checkROOM: ', values);
      if (values.total > 0) {
        console.log('Room found: ', values);
        return values.documents[0];
      } else {
        console.log('No room find, creating new one');
        return this.createRoom(userId);
      }
    });
  }

  // Get rooms from current session to initialize the message tab
  async listRooms(currentUserId: string) {
    this.cUserId = currentUserId;
    const promise = this.api.listDocuments(
      environment.appwrite.ROOMS_COLLECTION,
      [Query.search('users', currentUserId)]
    );
    await promise.then((values) => {
      values.documents.forEach((room) => {
        room = this.fillRoomWithUserData(room, currentUserId);
        room = this.fillRoomWithLastMessage(room);
      });
      // TODO: Order rooms by last message $createdAt
      /*
      values.documents.sort((a, b) => {
        const aLastMessage = a.lastMessage;
        const bLastMessage = b.lastMessage;
        if (aLastMessage && bLastMessage) {
          return bLastMessage.$createdAt - aLastMessage.$createdAt;
        } else if (aLastMessage) {
          return -1;
        } else if (bLastMessage) {
          return 1;
        } else {
          return 0;
        }
      });
      */
      console.log('listRooms: ', values.documents);
      this.rooms.next(values.documents);
    });
  }

  fillRoomWithUserData(room, currentUserId) {
    // Check if the user is not the current user
    room.users.forEach((userId) => {
      if (userId != currentUserId) {
        // Get the user data and add it to the element as userData
        room.userData = this.userService.getUserDoc(userId).then(
          (data) => {
            room.userData = data;
          },
          (error) => {
            console.log('error: ', error);
          }
        );
      }
    });
    return room;
  }

  async fillRoomWithLastMessage(room) {
    // Set Last message of every room
    const lastMessage = room.messages[room.messages.length - 1];
    room.lastMessage = lastMessage;
    return room;
  }

  getRoom(roomId: string): Promise<any> {
    return this.api.getDocument(environment.appwrite.ROOMS_COLLECTION, roomId);
  }

  async createRoom(userId: string): Promise<any> {
    // Set body
    const body = { to: userId };

    // Set x-appwrite-user-id header
    const currentUserId = this.authService.getUserId();
    axios.defaults.headers.common['x-appwrite-user-id'] = currentUserId;

    // Set x-appwrite-jwt header
    await this.authService.createJWT().then((result) => {
      console.log('result: ', result);
      axios.defaults.headers.common['x-appwrite-jwt'] = result?.jwt;
    });

    // Call the /api/room
    return axios
      .post('https://api.languagexchange.net/api/room', body)
      .then((result) => {
        console.log('result: ', result);
        return result.data;
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  }

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
}
