import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { BehaviorSubject } from 'rxjs';
import { Chat2Service } from 'src/app/services/chat/chat2.service';

interface Message {
  message: string;
  createdAt: Date;
  sender: string;
  seen: boolean;
}

@Component({
  selector: 'app-chat2',
  templateUrl: './chat2.page.html',
  styleUrls: ['./chat2.page.scss'],
})
export class Chat2Page implements OnInit {
  @ViewChild(IonContent) content: IonContent;

  messages: BehaviorSubject<Message[]> = new BehaviorSubject<Message[]>([]);
  message: string = '';
  typing: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private chatService: Chat2Service
  ) {}

  ngOnInit() {
    this.createmessages();
    this.newMsgComingFromServer();

    const chatRoomId: string = this.route.snapshot.paramMap.get('id');
    console.log(chatRoomId);

    this.getChatRoomData(chatRoomId);
    this.getChatMessages(chatRoomId);
  }

  ngAfterViewInit() {
    this.scrollToBottom();
  }

  getChatRoomData(chatRoomId: string) {
    this.chatService.getChatRoomData(chatRoomId).then((data) => {
      console.log(data);
    });
  }

  getChatMessages(chatRoomId: string) {
    this.chatService.getChatMessages(chatRoomId).subscribe((messages) => {
      console.log(messages);
    });
  }

  scrollToBottom() {
    this.content.scrollToBottom(0);
  }

  async pushMessage(message: Message) {
    const currentMessages = this.messages.getValue();
    const newMessages = [...currentMessages, message];
    const last20Messages = newMessages.slice(-20);
    this.messages.next(last20Messages);

    const scrollElement = await this.content.getScrollElement();

    // Check if current scroll position is at 80% of page height
    const scrollHeight = scrollElement.scrollHeight;
    const scrollTop = scrollElement.scrollTop;
    const clientHeight = scrollElement.clientHeight;
    if (scrollTop + clientHeight >= 0.8 * scrollHeight) {
      this.scrollToBottom();
    }
  }

  addUserMessage() {
    const newMessage: Message = {
      message: this.message,
      createdAt: new Date(),
      sender: 'Me',
      seen: false,
    };
    this.pushMessage(newMessage);
    this.message = '';
  }

  newMsgComingFromServer() {
    setInterval(() => {
      const users = ['Alice', 'Bob', 'Charlie'];
      const messages = [
        'Hello',
        'How are you?',
        'I am good, thanks!',
        'What about you?',
      ];
      const randomUser = users[Math.floor(Math.random() * users.length)];
      const randomMessage =
        messages[Math.floor(Math.random() * messages.length)];
      const newMessage: Message = {
        message: randomMessage,
        createdAt: new Date(),
        sender: randomUser,
        seen: false,
      };
      this.pushMessage(newMessage);
    }, 5000);
  }

  createmessages() {
    const users = ['Alice', 'Bob', 'Charlie'];
    const messages = [
      'Hello',
      'How are you?',
      'I am good, thanks!',
      'What about you?',
    ];
    const newMessages: Message[] = [];
    for (let i = 0; i < 50; i++) {
      const randomUser = users[Math.floor(Math.random() * users.length)];
      const randomMessage =
        messages[Math.floor(Math.random() * messages.length)];
      const newMessage: Message = {
        message: randomMessage,
        createdAt: new Date(),
        sender: randomUser,
        seen: false,
      };
      newMessages.push(newMessage);
    }
    const last20Messages = newMessages.slice(-20);
    this.messages.next(last20Messages);
  }
}
