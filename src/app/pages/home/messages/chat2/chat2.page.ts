import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Observable, of } from 'rxjs';

@Component({
  selector: 'app-chat2',
  templateUrl: './chat2.page.html',
  styleUrls: ['./chat2.page.scss'],
})
export class Chat2Page implements OnInit {

  @ViewChild('chatContainer') chatContainer: ElementRef;
  @ViewChild('chatMessages') chatMessages: ElementRef;
  messages: Observable<string[]>;

  constructor() { }

  ngOnInit() {
    this.createmessages();
  }

  scrollToBottom() {
    this.chatContainer.nativeElement.scrollTop = this.chatMessages.nativeElement.scrollHeight;
  }

  createmessages()  {
    this.messages = of([
      'Hello',
      'How are you?',
      'I am good, thanks!',
      'What about you?',
      'Hello',
      'How are you?',
      'I am good, thanks!',
      'What about you?',    'Hello',
      'How are you?',
      'I am good, thanks!',
      'What about you?',
      'Hello',
      'How are you?',
      'I am good, thanks!',
      'What about you?',    'Hello',
      'How are you?',
      'I am good, thanks!',
      'What about you?',
      'Hello',
      'How are you?',
      'I am good, thanks!',
      'What about you?',    'Hello',
      'How are you?',
      'I am good, thanks!',
      'What about you?',
      'Hello',
      'How are you?',
      'I am good, thanks!',
      'What about you?',
    ])
  }
}
