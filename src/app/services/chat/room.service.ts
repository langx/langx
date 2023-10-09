import { Injectable } from '@angular/core';
import { ApiService } from '../api/api.service';
import { environment } from 'src/environments/environment';
import { ID, Permission, Query, Role } from 'appwrite';
import { AuthService } from '../auth/auth.service';
import { UserService } from '../user/user.service';
import { TeamService } from '../team/team.service';

@Injectable({
  providedIn: 'root',
})
export class RoomService {
  constructor(
    private api: ApiService,
    private authService: AuthService,
    private userService: UserService,
    private teamService: TeamService
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
          users: [cUserId, userId]
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

  async createRoom(data: any): Promise<any> {
    // It triggers a function that creates a room
    return await this.api.functions
      .createExecution(
        'createRoom',
        `{"user1": "${data.users[0]}", "user2": "${data.users[1]}"}`
      )
      .then((result) => {
        console.log('execution:', result);
        return JSON.parse(result.responseBody);
      });
  }

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
