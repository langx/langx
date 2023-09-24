import { Injectable } from '@angular/core';
import { AppwriteService } from '../appwrite/appwrite.service';
import { environment } from 'src/environments/environment';
import { Query } from 'appwrite';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MessageService {
  messages: Subject<Object> = new Subject<Object>;

  constructor(private appwrite: AppwriteService) {}

  // TODO: Test it works or not
  listenMessages(roomID: string) {
    const client = this.appwrite.client$();
    return client.subscribe(
      'databases.' +
        environment.appwrite.APP_DATABASE +
        '.collections.' +
        environment.appwrite.MESSAGE_COLLECTION +
        '.documents',
      (response) => {
        this.messages.next(response.payload);
      }
    );
  }

  listMessages(roomId: string) {
    // return this.appwrite.listDocuments(
    const promise = this.appwrite.listDocuments(
      environment.appwrite.MESSAGE_COLLECTION,
      [Query.equal('roomId', roomId)]
    );
    promise.then(
      (response) => {
        //console.log(response.documents); // Success
        response.documents.forEach((doc) => {
          this.messages.next(doc);
        });
      },
      (error) => {
        console.log(error); // Failure
      }
    );
  }

  createMessage(data: any): Promise<any> {
    return this.appwrite.createDocument(
      environment.appwrite.MESSAGE_COLLECTION,
      data
    );
  }
}
