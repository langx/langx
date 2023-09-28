import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from 'src/app/services/auth/auth.service';
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

  chatRoomId: string = '';
  currentUserId: string = '';
  uid: string = '';
  uname: string = '';

  messages: BehaviorSubject<Message[]> = new BehaviorSubject<Message[]>([]);
  message: string = '';
  isTyping: boolean = false;
  isUserTyping: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private chatService: Chat2Service,
    private auth: AuthService
  ) {}

  ngOnInit() {
    this.createmessages();
    this.newMsgComingFromServer();

    const data: any = this.route.snapshot.queryParams;
    console.log('route snapshot data: ', data);
    if (data?.name) this.uname = data.name;
    if (data?.uid) this.uid = data.uid;
    const chatRoomId: string = this.route.snapshot.paramMap.get('id');
    this.chatRoomId = chatRoomId;
    this.currentUserId = this.auth.getId();

    this.getChatMessages(chatRoomId);
  }

  ngAfterViewInit() {
    this.content.scrollToBottom();
  }

  getChatMessages(chatRoomId: string) {
    this.chatService.getChatMessages(chatRoomId).subscribe((messages) => {
      console.log(messages);
    });
  }

  pushMessage(message: Message) {
    const currentMessages = this.messages.getValue();
    const newMessages = [...currentMessages, message];
    this.messages.next(newMessages);
    // const last20Messages = newMessages.slice(-20);
    // this.messages.next(last20Messages);
    this.content.scrollToBottom();
  }

  addUserMessage() {
    const newMessage: Message = {
      message: this.message,
      createdAt: new Date(),
      sender: 'Me',
      seen: false,
    };
    // TODO: Before pushing the message to the server, check if the user is typing
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
    }, 1000);
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
    for (let i = 0; i < 20; i++) {
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
    this.messages.next(newMessages);
  }
}
