import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { ApiService } from '../api/api.service';
import { RoomService } from '../chat/room.service';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  constructor(private api: ApiService, private roomService: RoomService) {}

  listen() {
    console.log('listener started');
    let channels = [];

    // channel for rooms
    const roomsCollection =
      'databases.' +
      environment.appwrite.APP_DATABASE +
      '.collections.' +
      environment.appwrite.ROOMS_COLLECTION +
      '.documents';
    // channel for messages
    const messagesCollection =
      'databases.' +
      environment.appwrite.APP_DATABASE +
      '.collections.' +
      environment.appwrite.MESSAGES_COLLECTION +
      '.documents';

    // add channels to array
    channels.push(roomsCollection);
    channels.push(messagesCollection);

    const client = this.api.client$();
    return client.subscribe(channels, (response) => {
      // check if the response is a new message
      response.events.forEach((event) => {
        switch (event) {
          case `${messagesCollection}.*.create`:
            console.log('new message created', response.payload);
            break;
          case `${messagesCollection}.*.update`:
            console.log('new message updated', response.payload);
            break;
          case `${messagesCollection}.*.delete`:
            console.log('new message deleted', response.payload);
            break;
          case `${roomsCollection}.*.create`:
            console.log('new room created', response.payload);
            this.roomService.updateRooms(response.payload);
            break;
          case `${roomsCollection}.*.update`:
            console.log('new room updated', response.payload);
            this.roomService.updateRooms(response.payload);
            break;
          case `${roomsCollection}.*.delete`:
            console.log('new room deleted', response.payload);
            break;
          default:
            break;
        }
      });
    });
  }
}
