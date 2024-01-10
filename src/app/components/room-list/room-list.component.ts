import {
  Component,
  Input,
  OnInit,
  Output,
  EventEmitter,
  ViewChild,
} from '@angular/core';
import { IonItemSliding } from '@ionic/angular';

import { lastSeen } from 'src/app/extras/utils';
import { Room } from 'src/app/models/Room';

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

  constructor() {}

  ngOnInit() {}

  getLastMessage(room) {
    let lastMessage = {
      body: null,
      time: null,
    };

    const type = room.messages[room.messages.length - 1]?.type || null;
    lastMessage.time =
      room.messages[room.messages.length - 1]?.$updatedAt || null;

    switch (type) {
      case 'body':
        lastMessage.body = room.messages[room.messages.length - 1].body;
        break;
      case 'image':
        lastMessage.body = '📷 Image';
        break;
      case 'audio':
        lastMessage.body = '🎵 Audio';
        break;
      // case 'video':
      //   lastMessage.body = '🎥 Video';
      //   break;
      // case 'file':
      //   lastMessage.body = '📁 File';
      //   break;
      default:
        lastMessage.body = 'Say Hi! 👋';
        break;
    }

    return lastMessage;
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
}
