import { Injectable } from '@angular/core';
import { ApiService } from '../api/api.service';
import { environment } from 'src/environments/environment';
import { ID, Query } from 'appwrite';
import { Auth2Service } from '../auth/auth2.service';
import { UserService } from '../user/user.service';

@Injectable({
  providedIn: 'root',
})
export class RoomService {
  constructor(
    private appwrite: ApiService,
    private auth2Service: Auth2Service,
    private userService: UserService
  ) {}

  async checkRoom(userId: string): Promise<any> {
    let cUserId = this.auth2Service.getUserId();
    console.log('checkRoom: ', cUserId, userId);

    const promise = this.appwrite.listDocuments(
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
    return this.appwrite
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
    return this.appwrite.getDocument(
      environment.appwrite.ROOMS_COLLECTION,
      roomId
    );
  }

  createRoom(data: any): Promise<any> {
    return this.appwrite.createDocument(
      environment.appwrite.ROOMS_COLLECTION,
      ID.unique(),
      data
    );
  }

  updateRoom(roomId: string, data: any): Promise<any> {
    return this.appwrite.updateDocument(
      environment.appwrite.ROOMS_COLLECTION,
      roomId,
      data
    );
  }

  // TODO: listen to room changes for messages.page.ts.
  // IDEA: use items collection, it will be relational one to many attribute which is named with the room id array
  listenRooms() {
    const client = this.appwrite.client$();
    return client.subscribe('documents', (response) => {
      if (
        response.events.includes(
          'databases.*.collections.' +
            environment.appwrite.ROOMS_COLLECTION +
            '.documents.*'
        )
      ) {
        console.log(response.payload);
      }
    });
  }
}
