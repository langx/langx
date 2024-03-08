import {
  Component,
  Input,
  OnInit,
  Output,
  EventEmitter,
  ViewChild,
} from '@angular/core';
import { IonItemSliding } from '@ionic/angular';

import { getFlagEmoji, lastSeen, onlineStatus } from 'src/app/extras/utils';
import { Room } from 'src/app/models/Room';
import { User } from 'src/app/models/User';

interface LastMessage {
  body: string | null;
  time: string | null;
  yourTurn: boolean;
}
@Component({
  selector: 'app-room-list',
  templateUrl: './room-list.component.html',
  styleUrls: ['./room-list.component.scss'],
})
export class RoomListComponent implements OnInit {
  @ViewChild(IonItemSliding) slidingItem: IonItemSliding;

  @Input() room: Room;
  @Input() currentUserId: string;
  @Input() isArchived: boolean;

  @Output() onClick: EventEmitter<any> = new EventEmitter();
  @Output() onArchive: EventEmitter<any> = new EventEmitter();
  @Output() onUnarchive: EventEmitter<any> = new EventEmitter();

  lastMessage: LastMessage = {
    body: null,
    time: null,
    yourTurn: false,
  };

  constructor() {}

  ngOnInit() {
    this.getLastMessage(this.room);
  }

  getLastMessage(room) {
    const type = room.messages[room.messages.length - 1]?.type || null;
    this.lastMessage.time =
      room.messages[room.messages.length - 1]?.$updatedAt || null;

    // Check if the last message is from the current user
    if (room.messages[room.messages.length - 1]?.to === this.currentUserId) {
      this.lastMessage.yourTurn = true;
    }

    switch (type) {
      case 'body':
        this.lastMessage.body = room.messages[room.messages.length - 1].body;
        break;
      case 'image':
        this.lastMessage.body = '📷 Image';
        break;
      case 'audio':
        this.lastMessage.body = '🎵 Audio';
        break;
      // case 'video':
      //   lastMessage.body = '🎥 Video';
      //   break;
      // case 'file':
      //   lastMessage.body = '📁 File';
      //   break;
      default:
        this.lastMessage.body = 'Say Hi! 👋';
        break;
    }

    // return lastMessage;
  }

  getChat(room) {
    this.onClick.emit(room);
  }

  archiveRoom(room: Room) {
    this.onArchive.emit(room);

    // Close the sliding item
    this.slidingItem.close();
  }

  unArchiveRoom(room: Room) {
    this.onUnarchive.emit(room);

    // Close the sliding item
    this.slidingItem.close();
  }

  //
  // Utils
  //

  getFlagEmoji(item: User) {
    return getFlagEmoji(item);
  }

  getBadge(room): number {
    return room.messages.filter(
      (message) => message.seen === false && message.to === this.currentUserId
    ).length;
  }

  messageTime(d: any) {
    if (!d) return null;
    let time = lastSeen(d);
    if (time === 'online') time = 'now';
    return time;
  }

  lastSeen(d: any) {
    if (!d) return null;
    return lastSeen(d);
  }

  onlineStatus(d: any) {
    if (!d) return null;
    return onlineStatus(d);
  }
}
