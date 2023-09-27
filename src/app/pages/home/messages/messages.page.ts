import { Component, OnInit } from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';
import { Observable, take } from 'rxjs';
import { lastSeen } from 'src/app/extras/utils';
import { Auth2Service } from 'src/app/services/auth/auth2.service';
import { RoomService } from 'src/app/services/chat/room.service';

@Component({
  selector: 'app-messages',
  templateUrl: './messages.page.html',
  styleUrls: ['./messages.page.scss'],
})
export class MessagesPage implements OnInit {
  // chatRooms: Observable<any>;
  chatRooms: any;
  isLoading: boolean = false;

  model = {
    icon: 'chatbubbles-outline',
    title: 'No Chat Rooms',
    color: 'warning',
  };

  constructor(
    private router: Router,
    private auth2Service: Auth2Service,
    private roomService: RoomService
  ) {}

  ngOnInit() {
    this.getRooms(); // get all chat Rooms
  }

  getRooms() {
    const cUserId = this.auth2Service.getUserId();
    this.roomService.getRooms(cUserId).then((data) => {
      this.chatRooms = data.documents;
      console.log('chat3Rooms: ', this.chatRooms);
    });
  }

  getChat(room) {
    const navData: NavigationExtras = {
      queryParams: {
        name: room?.userData?.name,
        uid: room?.userData?.$id,
      },
    };
    this.router.navigate(['/', 'home', 'chat3', room.$id], navData);
  }

  /*
  getRooms() {
    //TODO: showLoader();
    this.isLoading = true;
    this.chatService.getChatRooms();
    this.chatRooms = this.chatService.chatRooms;
    //TODO: hideLoader();
    this.isLoading = false;
  }

  getChat(item) {
    (item?.user).pipe(take(1)).subscribe((user_data) => {
      console.log('user_data', user_data);
      const navData: NavigationExtras = {
        queryParams: {
          name: user_data?.name,
          uid: user_data?.uid,
        },
      };
      // this.router.navigate(['/', 'home', 'chat', item.id], navData);
      this.router.navigate(['/', 'home', 'chat3', item.id], navData);
    });
  }
*/

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
