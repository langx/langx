import { Injectable } from '@angular/core';
import { AppwriteService } from '../appwrite/appwrite.service';
import { environment } from 'src/environments/environment';
import { Query } from 'appwrite';
import { AuthService } from '../auth/auth.service';
import { createReadStream } from 'fs';
import { ApiService } from '../api/api.service';

@Injectable({
  providedIn: 'root',
})
export class Chat3Service {
  constructor(
    private appwrite: AppwriteService,
    private auth: AuthService,
    private api: ApiService
  ) {}

  //
  // Rooms
  //

  checkRoom(userId: string): Promise<any> {
    this.auth.getId();
    let cUserId = this.auth.currentUser.uid;
    let t1 = `${cUserId}_${userId}`;
    let t2 = `${userId}_${cUserId}`;

    // console.log('t1: ', t1);
    // console.log('t2: ', t2);

    const res1 = this.appwrite.listDocuments(
      environment.appwrite.ROOMS_COLLECTION,
      [Query.equal('members', t1)]
    );
    const res2 = this.appwrite.listDocuments(
      environment.appwrite.ROOMS_COLLECTION,
      [Query.equal('members', t2)]
    );

    const promise = Promise.all([res1, res2]).then((values) => {
      return [...values[0].documents, ...values[1].documents];
    });

    return promise.then((values) => {
      if (values.length > 0) {
        console.log(' room found: ', values);
        return values[0];
      } else {
        console.log('no room find, create new one');
        return this.createRoom({
          members: t1,
          typing: [false, false],
        });
      }
    });
  }

  getRooms(currentUserId: string): Promise<any> {
    return this.appwrite
      .listDocuments(environment.appwrite.ROOMS_COLLECTION, [
        Query.search('members', currentUserId),
      ])
      .then((values) => {
        values.documents.forEach((element) => {
          let members = element.members.split('_');
          members[0] == currentUserId
            ? (element.user = members[1])
            : (element.user = members[0]);
          // TODO: FIRESTORE USER
          element.user = this.api.docDataQuery(`users/${element.user}`, true)
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
      data
    );
  }

  // TODO: listen to room changes for messages.page.ts
  listenRooms() {
    const client = this.appwrite.client$();
    return client.subscribe('documents', (response) => {
      if (
        response.events.includes(
          'databases.*.collections.' +
            environment.appwrite.ROOMS_COLLECTION +
            '.documents.*.update'
        )
      ) {
        console.log(response.payload);
      }
    });
  }

  //
  // Messages
  //

  listDocuments(): Promise<any> {
    return this.appwrite.listDocuments(
      environment.appwrite.MESSAGES_COLLECTION
    );
  }

  createDocument(data: any): Promise<any> {
    return this.appwrite.createDocument(
      environment.appwrite.MESSAGES_COLLECTION,
      data
    );
  }

  listenDocuments() {
    const client = this.appwrite.client$();
    return client.subscribe('documents', (response) => {
      if (
        response.events.includes(
          'databases.*.collections.' +
            environment.appwrite.MESSAGES_COLLECTION +
            '.documents.*.update'
        )
      ) {
        console.log(response.payload);
      }
    });
  }
}
