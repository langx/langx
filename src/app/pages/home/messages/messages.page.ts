import { Component, OnInit} from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';
import { Observable, take } from 'rxjs';
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
          name: user_data?.name
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

}