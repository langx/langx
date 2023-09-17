import { Injectable } from '@angular/core';
import { Database, ref, set } from '@angular/fire/database';

@Injectable({
  providedIn: 'root',
})
export class Chat3Service {
  chatsRef = ref(this.db, 'chats/');

  constructor(private db: Database) {}

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
}
