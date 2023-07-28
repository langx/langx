import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.page.html',
  styleUrls: ['./chat.page.scss'],
})
export class ChatPage implements OnInit {

  title = "sender name";
  message: string;
  isLoading = false;
  currentUserId: Number;

  chats = [
    {id: 1, sender: 1, message: 'hi'},
    {id: 1, sender: 2, message: 'hi there!'}
  ];

  constructor() { }

  ngOnInit() {
  }

  sendMessage(){}

}
