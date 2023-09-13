import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { Observable, of } from 'rxjs';

@Component({
  selector: 'app-chat2',
  templateUrl: './chat2.page.html',
  styleUrls: ['./chat2.page.scss'],
})
export class Chat2Page implements OnInit {
  @ViewChild(IonContent) content: IonContent;

  messages: Observable<string[]>;

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.createmessages();

    const chatRoomId: string = this.route.snapshot.paramMap.get('id');
    console.log(chatRoomId);
  }

  scrollToBottom() {
    this.content.scrollToBottom(300);
  }

  createmessages() {
    this.messages = of([
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
