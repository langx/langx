import { Injectable } from '@angular/core';
import { ApiService } from '../api/api.service';
import { environment } from 'src/environments/environment';
import { Query } from 'appwrite';
import { AuthService } from '../auth/auth.service';
import { UserService } from '../user/user.service';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class RoomService {
  rooms: BehaviorSubject<any[]> = new BehaviorSubject<any[]>([]);

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private userService: UserService
  ) {}

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
        return this.createRoom([cUserId, userId]);
      }
    });
  }

  // Get rooms from current session to initialize the message tab
  async listRooms(currentUserId: string) {
    const promise = this.api.listDocuments(
      environment.appwrite.ROOMS_COLLECTION,
      [Query.search('users', currentUserId)]
    );
    await promise.then((values) => {
      values.documents.forEach((room) => {
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
        // Set Last message of every room
        const lastMessage = room.messages[room.messages.length - 1];
        room.lastMessage = lastMessage;
      });
      this.rooms.next(values.documents.reverse());
    });
  }

  getRoom(roomId: string): Promise<any> {
    return this.api.getDocument(environment.appwrite.ROOMS_COLLECTION, roomId);
  }

  async createRoom(users: string[]): Promise<any> {
    // It triggers a function that creates a room
    const body = JSON.stringify({ users: users });
    return await this.api.functions
      .createExecution('createRoom', body)
      .then((result) => {
        console.log('execution:', result);
        return JSON.parse(result.responseBody);
      })
      .catch((error) => {
        console.log('error: ', error);
        return Promise.reject(error);
      });
  }

  // TODO: Delete this function
  updateRoom(roomId: string, data: any): Promise<any> {
    return this.api.updateDocument(
      environment.appwrite.ROOMS_COLLECTION,
      roomId,
      data
    );
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
