import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {

  segment = "chats";
  open_new_chat = false;

  constructor() { }

  ngOnInit() {
  }
  
  logout(){
    console.log('logout clicked!');
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
    this.open_new_chat = false;
    //console.log('cancel clicked!', this.open_new_chat)
  }

}
