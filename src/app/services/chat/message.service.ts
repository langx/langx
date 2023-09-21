import { Injectable } from '@angular/core';
import { AppwriteService } from '../appwrite/appwrite.service';
import { environment } from 'src/environments/environment';
import { Query } from 'appwrite';

@Injectable({
  providedIn: 'root',
})
export class MessageService {
  messages: any[] = [];

  constructor(private appwrite: AppwriteService) {}

  // TODO: Test it works or not
  listenMessages(roomId: string) {
    const client = this.appwrite.client$();
    return client.subscribe('documents', (response) => {
      if (
        response.events.includes(
          'databases.*.collections.' +
            environment.appwrite.ROOMS_COLLECTION +
            '.documents.' +
            roomId
        )
      ) {
        console.log(response.payload);
      }
    });
  }

  listMessages(roomId: string): Promise<any> {
    return this.appwrite.listDocuments(environment.appwrite.ROOMS_COLLECTION, [
      Query.equal('$id', roomId),
    ]);
  }

  createMessage(data: any): Promise<any> {
    return this.appwrite.createDocument(
      environment.appwrite.ROOMS_COLLECTION,
      data
    );
  }
}
