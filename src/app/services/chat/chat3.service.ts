import { Injectable } from '@angular/core';
import { AppwriteService } from '../appwrite/appwrite.service';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class Chat3Service {
  constructor(private appwrite: AppwriteService) {}

  //
  // Rooms
  //

  listRooms(): Promise<any> {
    return this.appwrite.listDocuments(environment.appwrite.ROOMS_COLLECTION);
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
