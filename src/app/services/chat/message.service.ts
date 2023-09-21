import { Injectable } from '@angular/core';
import { AppwriteService } from '../appwrite/appwrite.service';
import { environment } from 'src/environments/environment';
import { Query } from 'appwrite';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MessageService {
  messages: any[] = [];

  constructor(private appwrite: AppwriteService) {}

  // TODO: Test it works or not
  listenMessages(roomId: string) {
    const client = this.appwrite.client$();
    //let channel = `databases.${environment.appwrite.APP_DATABASE}.collections.${environment.appwrite.MESSAGES_COLLECTION}.document`;
    let channel =
      'databases.' +
      environment.appwrite.APP_DATABASE +
      '.collections.' +
      environment.appwrite.MESSAGES_COLLECTION +
      '.documents.create';
    let channel2 = 'documents';
    return client.subscribe(channel, (response) => {
      console.log(response.payload);
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
