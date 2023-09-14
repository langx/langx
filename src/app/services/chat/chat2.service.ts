import { Injectable } from '@angular/core';
import { ApiService } from '../api/api.service';
import { map } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class Chat2Service {
  constructor(private api: ApiService) {}

  addMessage(chatRoomId: string, message: string, sender: string) {
    const data = {
      message,
      sender,
      createdAt: new Date(),
      seen: false,
    };
    return this.api.addDocument(`chats/${chatRoomId}/messages`, data);
  }

  async getChatRoomData(chatRoomId: string) {
    const docSnap: any = await this.api.getDocById(`chatRooms/${chatRoomId}`);
    if (docSnap?.exists()) {
      return docSnap.data();
    } else {
      return null;
    }
  }

  getChatMessages(chatRoomId: string) {
    return this.api
      .collectionDataQuery(
        `chats/${chatRoomId}/messages`,
        this.api.orderByQuery('createdAt', 'desc')
      )
      .pipe(map((arr: any) => arr.reverse()));
  }

}
