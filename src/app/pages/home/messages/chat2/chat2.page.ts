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
  chatRoomData: any = {};
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

    this.getChatRoomData(chatRoomId);
    this.getChatMessages(chatRoomId);
  }

  ngAfterViewInit() {
    this.content.scrollToBottom();
  }

  getChatRoomData(chatRoomId: string) {
    this.chatService.getChatRoomData(chatRoomId).then((data) => {
      // TODO: not updating the typing status when it changes
      this.chatRoomData = data;
      console.log('chatRoomData: ', this.chatRoomData);
      this.isUserTyping = this.chatRoomData.typingStatus[this.uid];
    });
  }

  getChatMessages(chatRoomId: string) {
    this.chatService.getChatMessages(chatRoomId).subscribe((messages) => {
      console.log(messages);
    });
  }

  async scrollToBottom() {
    const scrollElement = await this.content.getScrollElement();

    // Check if current scroll position is at 80% of page height
    const scrollHeight = scrollElement.scrollHeight;
    const scrollTop = scrollElement.scrollTop;
    const clientHeight = scrollElement.clientHeight;
    if (scrollTop + clientHeight >= 0.8 * scrollHeight) {
      this.content.scrollToBottom();
    }
  }

  pushMessage(message: Message) {
    const currentMessages = this.messages.getValue();
    const newMessages = [...currentMessages, message];
    this.messages.next(newMessages);
    // const last20Messages = newMessages.slice(-20);
    // this.messages.next(last20Messages);
    this.scrollToBottom();
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
    this.chatService
      .updateTypingStatus(this.chatRoomId, this.currentUserId, this.isTyping)
      .then(() => console.log('Typing status updated successfully'))
      .catch((error) => console.error('Error updating typing status:', error));
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
    this.messages.next(newMessages);
    // const last20Messages = newMessages.slice(-20);
    // this.messages.next(last20Messages);
  }
}
