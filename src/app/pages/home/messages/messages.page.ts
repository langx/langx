import { Component, OnInit } from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { lastSeen } from 'src/app/extras/utils';
import { AuthService } from 'src/app/services/auth/auth.service';
import { RoomService } from 'src/app/services/chat/room.service';

@Component({
  selector: 'app-messages',
  templateUrl: './messages.page.html',
  styleUrls: ['./messages.page.scss'],
})
export class MessagesPage implements OnInit {
  rooms: BehaviorSubject<any[]> = new BehaviorSubject<any[]>([]);
  isLoading: boolean = false;

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

  async ngOnInit() {
    await this.listRooms(); // get all chat Rooms
  }

  async listRooms() {
    const cUserId = this.authService.getUserId();
    await this.roomService.listRooms(cUserId);
    this.rooms = this.roomService.rooms;
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

  openArchiveMessages() {
    console.log('openArchiveMessages clicked');
  }

  handleRefresh(event) {
    this.listRooms();
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
