import { Injectable } from '@angular/core';
import { ApiService } from '../api/api.service';
import { map } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class Chat2Service {
  constructor(private api: ApiService) {}

  getChatRoomMessages(chatRoomId: string) {
    return this.api
      .collectionDataQuery(
        `chats2/${chatRoomId}/messages`,
        this.api.orderByQuery('createdAt', 'desc')
      )
      .pipe(map((arr: any) => arr.reverse()));
  }
}
