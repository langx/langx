import { Component, OnInit } from '@angular/core';
import { Database } from '@angular/fire/database';
import { Chat3Service } from 'src/app/services/chat/chat3.service';

@Component({
  selector: 'app-chat3',
  templateUrl: './chat3.page.html',
  styleUrls: ['./chat3.page.scss'],
})
export class Chat3Page implements OnInit {
  message: string = '';
  isTyping: boolean = false;

  constructor(private chatService: Chat3Service) {}

  ngOnInit() {}

  sendMessage() {
    this.chatService.writeChatData('1', 'name', 'email', 'imageUrl');
  }

  typingFocus() {
    this.isTyping = true;
    this.onTypingStatusChange();
  }

  typingBlur() {
    this.isTyping = false;
    this.onTypingStatusChange();
  }

  onTypingStatusChange() {
    console.log('onTypingStatusChange', this.isTyping);
  }
}
