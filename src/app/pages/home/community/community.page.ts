import { Component, OnInit } from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ChatService } from 'src/app/services/chat/chat.service';

@Component({
  selector: 'app-community',
  templateUrl: './community.page.html',
  styleUrls: ['./community.page.scss'],
})
export class CommunityPage implements OnInit {

  users: Observable<any>;
  isLoading: boolean = false;
  open_new_chat:boolean = false;

  constructor(
    private router: Router,
    private chatService: ChatService
  ) { }

  ngOnInit() {
    this.getUsers(); // get all Community Users
  }

  getUsers() {
    //TODO: showLoader();
    this.isLoading = true;
    this.chatService.getUsers();
    this.users = this.chatService.users;    
    //TODO: hideLoader();
    this.isLoading = false;
  }

  async startChat(item) {
    try {
      // showLoader();
      this.isLoading = true;
      // create chatroom
      const room = await this.chatService.createChatRoom(item?.uid);
      console.log('room: ', room);
      this.cancel();
      const navData: NavigationExtras = {
        queryParams: {
          name: item?.name
        }
      };
      this.router.navigate(['/', 'home', 'chats', room?.id], navData);
      // hideLoader();
      this.isLoading = false;
    } catch(e) {
      console.log(e);
      // hideLoader();
      this.isLoading = false;
    }
  }  

  cancel(){
    this.open_new_chat = false;
  }

  openFilterModal(){
    console.log('openFilterModal clicked');
  }

}
