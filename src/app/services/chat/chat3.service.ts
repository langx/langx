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
