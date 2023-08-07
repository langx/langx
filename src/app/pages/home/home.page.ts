import { Component, HostListener, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
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
    //console.log('newChat clicked!', this.open_new_chat)
  }

  getUser() {
    this.chatService.getUsers();
    this.users = this.chatService.users;    
  }

  onWillDismiss(event: any) {}

  cancel(){
    this.modal.dismiss()
    this.open_new_chat = false;
  }
  // cancel when the escape button pressed
  // TODO: it could be the upper side of this file
  @HostListener('document:keydown.escape', ['$event']) onKeydownHandler(event: KeyboardEvent) {
    this.modal.dismiss()
    this.open_new_chat = false;
  }

  startChat(item: any) {
    console.log('startChat() in home.page.ts', item);
  }

  getChat(item) {
    this.router.navigate(['/', 'home', 'chats', item.id])
  }
    
}