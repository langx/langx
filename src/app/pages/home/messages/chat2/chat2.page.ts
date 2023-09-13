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

    const chatRoomId: string = this.route.snapshot.paramMap.get('id');
    console.log(chatRoomId);
  }

  scrollToBottom() {
    this.content.scrollToBottom(300);
  }

  pushMessage() {
    this.messages.next([
      ...this.messages.getValue(),
      'Another message'
    ]);
    this.content.scrollToBottom();
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
