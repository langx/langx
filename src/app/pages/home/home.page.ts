import { Component, HostListener, OnInit, ViewChild } from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';
import { PopoverController } from '@ionic/angular';
import { Observable, take } from 'rxjs';
import { AuthService } from 'src/app/services/auth/auth.service';
import { ChatService } from 'src/app/services/chat/chat.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {

  @ViewChild('popover') popover: PopoverController;
  @HostListener('document:keydown.escape', ['$event']) onKeydownHandler(event: KeyboardEvent) {
    this.cancel();
  }

  segment: string = "profile";
  open_new_chat = false;
  users: Observable<any>;
  chatRooms: Observable<any>;
  currentUser: any;
  model = {
    icon: 'chatbubbles-outline',
    title: 'No Chat Rooms',
    color: 'warning'
  }

  constructor(
    private router: Router,
    private chatService: ChatService,
    private auth: AuthService
  ) { }

  ngOnInit() {
    this.getRooms(); // get all chat Rooms
    this.getUsers(); // get all Community Users
    this.getProfileInfo(); // get currentUser for profile info
  }

  getProfileInfo() {
      //TODO: showLoader();
      let id = this.auth.getId();
      this.auth.getUserData(id).then(user => {
        this.currentUser = user;
        console.log(this.currentUser);
        //TODO: hideLoader();
      })
  }

  getRooms() {
    this.chatService.getChatRooms();
    this.chatRooms = this.chatService.chatRooms;
  }

  async logout(){
    try {
      //TODO: showLoader();
      this.popover.dismiss();
      await this.chatService.auth.logout();
      this.router.navigateByUrl('/login', {replaceUrl: true});
      //TODO: hideLoader();
    } catch(e) {
      console.log(e);
    }
  }

  onSegmentChanged(event: any) {
    this.segment = event.detail.value;
  }

  newChat(){
    this.open_new_chat = true;
    if(!this.users) this.getUsers();
  }

  getUsers() {
    this.chatService.getUsers();
    this.users = this.chatService.users;    
  }

  onWillDismiss(event: any) {}

  cancel(){
    this.open_new_chat = false;
  }

  async startChat(item) {
    try {
      // show.loader();
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
      // hide.loader();
    } catch(e) {
      console.log(e);
      // hide.loader();
    }
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
      this.router.navigate(['/', 'home', 'chats', item.id], navData);
    });
  }

  getUser(user: any) {
    return user;
  }
    
}