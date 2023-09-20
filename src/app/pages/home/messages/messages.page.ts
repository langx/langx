import { Component, OnInit } from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';
import { Observable, take } from 'rxjs';
import { lastSeen } from 'src/app/extras/utils';
import { AuthService } from 'src/app/services/auth/auth.service';
import { ChatService } from 'src/app/services/chat/chat.service';
import { Chat3Service } from 'src/app/services/chat/chat3.service';

@Component({
  selector: 'app-messages',
  templateUrl: './messages.page.html',
  styleUrls: ['./messages.page.scss'],
})
export class MessagesPage implements OnInit {
  chatRooms: Observable<any>;
  chat3Rooms: any;
  isLoading: boolean = false;

  model = {
    icon: 'chatbubbles-outline',
    title: 'No Chat Rooms',
    color: 'warning',
  };

  constructor(
    private router: Router,
    private auth: AuthService,
    private chatService: ChatService,
    private chat3Service: Chat3Service
  ) {}

  ngOnInit() {
    this.get3Rooms(); // get all chat Rooms
  }

  async get3Rooms() {
    let cUserId = this.auth.getId();
    console.log('cUserId: ', cUserId);
    const promise = this.chat3Service.getRooms(cUserId);
    promise.then((data) => {
      this.chat3Rooms = data.documents;
      console.log('chat3Rooms: ', this.chat3Rooms);
    });
  }

  get3Chat(item) {
    (item?.userData).pipe(take(1)).subscribe((user_data) => {
      console.log('user_data', user_data);
      const navData: NavigationExtras = {
        queryParams: {
          name: user_data?.name,
          uid: user_data?.uid,
        },
      };
      this.router.navigate(['/', 'home', 'chat3', item.$id], navData);
    });
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
    this.get3Rooms();
    event.target.complete();
    console.log('Async operation refresh has ended');
  }

  archiveChat(room) {
    console.log('archiveChat clicked', room);
  }

  lastSeen(d: any) {
    if (!d) return null;
    let a = new Date(d.seconds * 1000);
    return lastSeen(a);
  }
}
