import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { BehaviorSubject, of } from 'rxjs';

interface Message {
  message: string;
  lastSeen: {
    date: Date;
    user: string;
  };
}

@Component({
  selector: 'app-chat2',
  templateUrl: './chat2.page.html',
  styleUrls: ['./chat2.page.scss'],
})
export class Chat2Page implements OnInit {
  @ViewChild(IonContent) content: IonContent;

  messages: BehaviorSubject<Message[]> = new BehaviorSubject<Message[]>([]);

  newMessage: string = '';

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.createmessages();
    this.newMsgComingFromServer();

    const chatRoomId: string = this.route.snapshot.paramMap.get('id');
    console.log(chatRoomId);
  }

  scrollToBottom() {
    this.content.scrollToBottom(500);
  }

  async pushMessage(newMessage: string, user: string) {
    const message: Message = {
      message: newMessage,
      lastSeen: {
        date: new Date(),
        user: user,
      },
    };
    this.messages.next([...this.messages.getValue(), message]);

    const scrollElement = await this.content.getScrollElement();

    // Check if current scroll position is at 80% of page height
    const scrollHeight = scrollElement.scrollHeight;
    const scrollTop = scrollElement.scrollTop;
    const clientHeight = scrollElement.clientHeight;
    if (scrollTop + clientHeight >= 0.8 * scrollHeight) {
      this.scrollToBottom();
    }
  }

  newMsgComingFromServer() {
    setInterval(() => {
      const users = ['Alice', 'Bob', 'Charlie'];
      const messages = ['Hello', 'How are you?', 'I am good, thanks!', 'What about you?'];
      const randomUser = users[Math.floor(Math.random() * users.length)];
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      this.pushMessage(randomMessage, randomUser);
    }, 5000);
  }

  createmessages() {
    const users = ['Alice', 'Bob', 'Charlie'];
    const messages = ['Hello', 'How are you?', 'I am good, thanks!', 'What about you?'];
    const newMessages: Message[] = [];
    for (let i = 0; i < 50; i++) {
      const randomUser = users[Math.floor(Math.random() * users.length)];
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      const newMessage: Message = {
        message: randomMessage,
        lastSeen: {
          date: new Date(),
          user: randomUser,
        },
      };
      newMessages.push(newMessage);
    }
    this.messages.next(newMessages);
  }
}
