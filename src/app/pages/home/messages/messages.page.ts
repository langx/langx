import { Component, OnInit } from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';
import { lastSeen } from 'src/app/extras/utils';
import { AuthService } from 'src/app/services/auth/auth.service';
import { RoomService } from 'src/app/services/chat/room.service';

@Component({
  selector: 'app-messages',
  templateUrl: './messages.page.html',
  styleUrls: ['./messages.page.scss'],
})
export class MessagesPage implements OnInit {
  chatRooms: any;
  isLoading: boolean = false;

  roomServiceFn: Function;
  messageServiceFn: Function;

  model = {
    icon: 'chatbubbles-outline',
    title: 'No Chat Rooms',
    color: 'warning',
  };

  constructor(
    private router: Router,
    private authService: AuthService,
    private roomService: RoomService
  ) {}

  ngOnInit() {
    this.getRooms(); // get all chat Rooms
  }

  getRooms() {
    const cUserId = this.authService.getUserId();
    this.roomService.getRooms(cUserId).then((data) => {
      // Last message of every room
      data.documents.forEach((room) => {
        const lastMessage = room.messages[room.messages.length - 1];
        room.lastMessage = lastMessage;
      });
      this.chatRooms = data.documents;
      console.log('chatRooms: ', this.chatRooms);
    });

    // TODO: #169 listen rooms changes
  }

  getChat(room) {
    const navData: NavigationExtras = {
      queryParams: {
        name: room?.userData?.name,
        uid: room?.userData?.$id,
      },
    };
    this.router.navigate(['/', 'home', 'chat', room.$id], navData);
  }

  getUser(user: any) {
    return user;
  }

  openArchiveMessages() {
    console.log('openArchiveMessages clicked');
  }

  handleRefresh(event) {
    this.getRooms();
    event.target.complete();
    console.log('Async operation refresh has ended');
  }

  archiveChat(room) {
    console.log('archiveChat clicked', room);
  }

  lastSeen(d: any) {
    if (!d) return null;
    return lastSeen(d);
  }
}
