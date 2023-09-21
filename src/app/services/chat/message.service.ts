import { Injectable } from '@angular/core';
import { AppwriteService } from '../appwrite/appwrite.service';
import { environment } from 'src/environments/environment';
import { Query } from 'appwrite';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MessageService {
  messages = new BehaviorSubject<any>(null);

  constructor(private appwrite: AppwriteService) {}

  // TODO: Test it works or not
  listenMessages(roomID: string) {
    const client = this.appwrite.client$();
    return client.subscribe(
      'databases.' +
        environment.appwrite.APP_DATABASE +
        '.collections.' +
        environment.appwrite.MESSAGES_COLLECTION +
        '.documents',
      (response) => {
        this.messages.next(response.payload);
      }
    );
  }

  listMessages(roomId: string): Promise<any> {
    return this.appwrite.listDocuments(
      environment.appwrite.MESSAGES_COLLECTION,
      [Query.equal('roomId', roomId)]
    );
  }

  createMessage(data: any): Promise<any> {
    return this.appwrite.createDocument(
      environment.appwrite.MESSAGES_COLLECTION,
      data
    );
  }
}
