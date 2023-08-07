import { Component, HostListener, OnInit, ViewChild } from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';
import { ModalController, PopoverController } from '@ionic/angular';
import { Observable } from 'rxjs';
import { ChatService } from 'src/app/services/chat/chat.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {

  @ViewChild('new_chat') modal: ModalController;
  @ViewChild('popover') popover: PopoverController;
  @HostListener('document:keydown.escape', ['$event']) onKeydownHandler(event: KeyboardEvent) {
    this.cancel();
  }

  segment = "community";
  open_new_chat = false;
  users: Observable<any>;
  //users = [
  //  {id:1, name:"Test", photo:"https://i.pravatar.cc/385"},
  //  {id:2, name:"Test2", photo:"https://i.pravatar.cc/375"},
  //  {id:3, name:"Test3", photo:"https://i.pravatar.cc/365"},
  //];
  
  chatRooms = [
    {id:1, name:"Chat Room Test", photo:"https://i.pravatar.cc/385"},
    {id:2, name:"Chat Room 2", photo:"https://i.pravatar.cc/375"},
    {id:3, name:"CHat 3", photo:"https://i.pravatar.cc/365"},
  ];


  constructor(
    private router: Router,
    private chatService: ChatService
  ) { }

  ngOnInit() {
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
    if(!this.users) this.getUser();
  }

  getUser() {
    this.chatService.getUsers();
    this.users = this.chatService.users;    
  }

  onWillDismiss(event: any) {}

  cancel(){
    this.modal.dismiss();
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
    this.router.navigate(['/', 'home', 'chats', item.id])
  }
    
}