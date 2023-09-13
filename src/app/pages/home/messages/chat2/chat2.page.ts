import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { BehaviorSubject, of } from 'rxjs';

@Component({
  selector: 'app-chat2',
  templateUrl: './chat2.page.html',
  styleUrls: ['./chat2.page.scss'],
})
export class Chat2Page implements OnInit {
  @ViewChild(IonContent) content: IonContent;

  messages: BehaviorSubject<string[]> = new BehaviorSubject<string[]>([]);

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.createmessages();
    this.newMsgComingFromServer();

    const chatRoomId: string = this.route.snapshot.paramMap.get('id');
    console.log(chatRoomId);
  }

  scrollToBottom() {
    this.content.scrollToBottom(300);
  }

  async pushMessage(msg: string) {
    this.messages.next([...this.messages.getValue(), msg]);

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
      this.pushMessage('Hello');
    }, 5000);
  }

  createmessages() {
    this.messages.next([
      'Hello',
      'How are you?',
      'I am good, thanks!',
      'What about you?',
      'Hello',
      'How are you?',
      'I am good, thanks!',
      'What about you?',
      'Helloaaaaaa',
      'How are you?',
      'I am good, thanks!',
      'What about you?',
      'Hello',
      'How are you?',
      'I am good, thanks!',
      'What about you?',
      'Helloaaaaaa',
      'How are you?',
      'I am good, thanks!',
      'What about you?',
      'Hello',
      'How are you?',
      'I am good, thanks!',
      'What about you?',
      'Helloaaaaaa',
      'How are you?',
      'I am good, thanks!',
      'What about you?',
      'Hello',
      'How are you?',
      'I am good, thanks!',
      'What about you?',
      'Hello',
      'How are you?',
      'I am good, thanks!',
      'What about you?',
      'Hello',
      'How are you?',
      'I am good, thanks!',
      'What about you?',
      'Helloaaaaaa',
      'How are you?',
      'I am good, thanks!',
      'What about you?',
      'Hello',
      'How are you?',
      'I am good, thanks!',
      'What about you?',
      'Helloaaaaaa',
      'How are you?',
      'I am good, thanks!',
      'What about you?',
      'Hello',
      'How are you?',
      'I am good, thanks!',
      'What about you?',
      'Helloaaaaaa',
      'How are you?',
      'I am good, thanks!',
      'What about you?',
      'Hello',
      'How are you?',
      'I am good, thanks!',
      'What about you?',
    ]);
  }
}
