import { Injectable } from '@angular/core';
import { AppwriteService } from '../appwrite/appwrite.service';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class Chat3Service {
  constructor(private appwrite: AppwriteService) {}

  listDocuments(): Promise<any> {
    return this.appwrite.listDocuments(
      environment.appwrite.MESSAGES_COLLECTION
    );
  }

  listenDocuments() {
    const client = this.appwrite.client$();
    return client.subscribe('documents', (response) => {
      if (
        response.events.includes('databases.*.collections.*.documents.*.update')
      ) {
        console.log(response.payload);
      }
    });
  }

  createDocument(data: any): Promise<any> {
    return this.appwrite.createDocument(
      environment.appwrite.MESSAGES_COLLECTION,
      data
    );
  }

  /*
  writeChatData(userId, name, email, imageUrl) {
    set(ref(this.db, 'chats/' + userId), {
      username: name,
      email: email,
      profile_picture: imageUrl,
    })
      .then(() => {
        console.log('Synchronization succeeded');
      })
      .catch((error) => {
        console.log('Synchronization failed');
      });
  }
  */
}
