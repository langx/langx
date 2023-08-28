import { Component, OnInit} from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';
import { Observable, take } from 'rxjs';
import { lastSeen } from 'src/app/extras/utils';
import { ChatService } from 'src/app/services/chat/chat.service';

@Component({
  selector: 'app-messages',
  templateUrl: './messages.page.html',
  styleUrls: ['./messages.page.scss'],
})
export class MessagesPage implements OnInit {
  
  chatRooms: Observable<any>;
  isLoading: boolean = false;

  model = {
    icon: 'chatbubbles-outline',
    title: 'No Chat Rooms',
    color: 'warning'
  }

  constructor(
    private router: Router,
    private chatService: ChatService,
  ) { }

  ngOnInit() {
    this.getRooms(); // get all chat Rooms
  }

  getRooms() {
    //TODO: showLoader();
    this.isLoading = true;
    this.chatService.getChatRooms();
    this.chatRooms = this.chatService.chatRooms;
    //TODO: hideLoader();
    this.isLoading = false;
  }

  getChat(item) {
    (item?.user).pipe(
      take(1)
    ).subscribe(user_data => {
      console.log('user_data', user_data);
      const navData: NavigationExtras = {
        queryParams: {
          name: user_data?.name,
          uid: user_data?.uid,
        }
      };
      this.router.navigate(['/', 'home', 'chat', item.id], navData);
    });
  }

  getUser(user: any) {
    return user;
  }

  openArchiveMessages(){
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
    let a = new Date(d.seconds * 1000)
    return lastSeen(a);
   }

}