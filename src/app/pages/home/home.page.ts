import { Component, HostListener, OnInit, ViewChild } from '@angular/core';
import { ModalController, PopoverController } from '@ionic/angular';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {

  @ViewChild('new_chat') modal: ModalController;
  @ViewChild('popover') popover: PopoverController;

  segment = "chats";
  open_new_chat = false;
  //users: Observable<any>;
  users = [
    {id:1, name:"Test", photo:"https://i.pravatar.cc/385"},
    {id:2, name:"Test2", photo:"https://i.pravatar.cc/375"},
    {id:3, name:"Test3", photo:"https://i.pravatar.cc/365"},
  ];

  constructor() { }

  ngOnInit() {
  }
  
  logout(){
    this.popover.dismiss();
  }

  onSegmentChanged(event: any) {
    console.log("SEGMENT:", event.detail.value);
  }

  newChat(){
    this.open_new_chat = true;
    //console.log('newChat clicked!', this.open_new_chat)
  }

  onWillDismiss(event: any) {}

  cancel(){
    this.modal.dismiss()
    this.open_new_chat = false;
  }
  // cancel when the escape button pressed
  @HostListener('document:keydown.escape', ['$event']) onKeydownHandler(event: KeyboardEvent) {
    this.modal.dismiss()
    this.open_new_chat = false;
  }

  startChat(item: any) {
    console.log(item.id, item.name)
  }

}
