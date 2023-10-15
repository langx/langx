import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { ApiService } from '../api/api.service';
import { RoomService } from '../chat/room.service';
import { MessageService } from '../chat/message.service';
import { AuthService } from '../auth/auth.service';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  listenerFn: Function;

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private roomService: RoomService,
    private messageService: MessageService
  ) {}

  listen() {
    // Presence ping
    this.presencePing();

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
    this.listenerFn = client.subscribe(channels, (response) => {
      // check if the response is a new message
      response.events.forEach((event) => {
        switch (event) {
          case `${messagesCollection}.*.create`:
            console.log('new message created', response.payload);
            this.findAndUpdateRoom(response.payload);
            this.findAndUpdateMessages(response.payload);
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
    return this.listenerFn;
  }

  unsubscribe() {
    if (this.listenerFn) {
      this.listenerFn();
    }
  }

  findAndUpdateRoom(message) {
    const rId = message?.roomId?.$id;
    let room = this.roomService.rooms.getValue().find((r) => r.$id === rId);
    if (!room) return;
    room.messages.push(message);
    this.roomService.updateRooms(room);
  }

  findAndUpdateMessages(message) {
    let messages = this.messageService.messages.getValue();
    if (messages.length == 0) return;
    const rId = message?.roomId?.$id;
    console.log(messages[0]);
    if (messages[0]?.roomId?.$id === rId) {
      this.messageService.updateMessages(message);
    }
  }

  presencePing() {
    // Update user in user collection lastSeen attribute with timeout of every 60 seconds
    setInterval(() => {
      this.updateUserPresence();
    }, 6000);
  }

  updateUserPresence() {
    this.api
      .updateDocument(
        environment.appwrite.USERS_COLLECTION,
        this.authService.getUserId(),
        { lastSeen: new Date() }
      )
      .then((res) => {
        console.log('User presence updated');
      })
      .catch((err) => {
        console.log('User presence coudnt updated.', err);
      });
  }
}
