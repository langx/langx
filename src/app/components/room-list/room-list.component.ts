import { Observable } from 'rxjs';
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

import { UserService } from 'src/app/services/user/user.service';
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

  profilePic$: Observable<URL> = null;

  lastMessage: LastMessage = {
    body: null,
    time: null,
    yourTurn: false,
  };

  constructor(private userService: UserService) {}

  ngOnInit() {
    this.getLastMessage(this.room);
    this.profilePic$ = this.userService.getUserFilePreview(
      this.room['userData'].profilePic
    );
  }

  getLastMessage(room) {
    const lastMessage = room.messages[room.messages.length - 1];

    const type = lastMessage?.type || null;
    this.lastMessage.time = lastMessage?.$updatedAt || null;

    // Check if the last message is from the current user
    if (lastMessage?.to === this.currentUserId) {
      this.lastMessage.yourTurn = true;
    }

    switch (type) {
      case 'body':
        this.lastMessage.body = lastMessage.body;
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

  getBadge(room: Room): number {
    if (room.users[0] === this.currentUserId) {
      return room.unseen[0] || 0;
    } else {
      return room.unseen[1] || 0;
    }
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
