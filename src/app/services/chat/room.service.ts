import { Injectable } from '@angular/core';
import { ApiService } from '../api/api.service';
import { environment } from 'src/environments/environment';
import { ID, Permission, Query, Role } from 'appwrite';
import { AuthService } from '../auth/auth.service';
import { UserService } from '../user/user.service';

@Injectable({
  providedIn: 'root',
})
export class RoomService {
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
        return this.createRoom({
          users: [cUserId, userId],
          typing: [false, false],
        });
      }
    });
  }

  async getRooms(currentUserId: string): Promise<any> {
    return this.api
      .listDocuments(environment.appwrite.ROOMS_COLLECTION, [
        Query.search('users', currentUserId),
      ])
      .then((values) => {
        values.documents.forEach((element) => {
          // Check if the user is not the current user
          element.users.forEach((userId) => {
            if (userId != currentUserId) {
              // Get the user data and add it to the element as userData
              element.userData = this.userService.getUserDoc(userId).then(
                (data) => {
                  element.userData = data;
                },
                (error) => {
                  console.log('error: ', error);
                }
              );
            }
          });
        });
        return values;
      });
  }

  getRoom(roomId: string): Promise<any> {
    return this.api.getDocument(environment.appwrite.ROOMS_COLLECTION, roomId);
  }

  // TODO: Error: AppwriteException: Permissions must be one of: (any, users, user:6512ed1d95e48c227190, user:6512ed1d95e48c227190/unverified, users/unverified)
  // Answer: Yes, you can use a team or an appwrite function
  // https://discord.com/channels/564160730845151244/1158556321801588860
  createRoom(data: any): Promise<any> {
    console.log(data);
    return this.api.createDocument(
      environment.appwrite.ROOMS_COLLECTION,
      ID.unique(),
      data,
      [
        Permission.read(Role.user(data.users[0])),
        Permission.read(Role.user(data.users[1])),
      ]
    );
  }

  updateRoom(roomId: string, data: any): Promise<any> {
    return this.api.updateDocument(
      environment.appwrite.ROOMS_COLLECTION,
      roomId,
      data
    );
  }

  // TODO: #169 listen to room changes for messages.page.ts.
  listenRooms() {
    const client = this.api.client$();
    return client.subscribe(
      'databases.' +
        environment.appwrite.APP_DATABASE +
        '.collections.' +
        environment.appwrite.ROOMS_COLLECTION,
      (response) => {
        console.log(response.payload);
      }
    );
  }
}
