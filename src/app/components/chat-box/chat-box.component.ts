import { Store } from '@ngrx/store';
import {
  Component,
  Input,
  OnInit,
  ElementRef,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';

import { lastSeen } from 'src/app/extras/utils';
import { Message } from 'src/app/models/Message';
import { updateMessageAction } from 'src/app/store/actions/message.action';

@Component({
  selector: 'app-chat-box',
  templateUrl: './chat-box.component.html',
  styleUrls: ['./chat-box.component.scss'],
})
export class ChatBoxComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() chat: Message;
  @Input() current_user_id: string;

  private observer: IntersectionObserver;

  msg: Message = null;

  constructor(private store: Store, private el: ElementRef) {}

  ngOnInit() {
    this.msg = { ...this.chat };
  }

  ngAfterViewInit() {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => this.handleIntersect(entry));
    });
    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy() {
    this.observer.disconnect();
  }

  handleIntersect(entry) {
    if (entry.isIntersecting) {
      if (this.msg.to === this.current_user_id && this.msg.seen === false) {
        console.log(entry.target, ' seen');
        this.msg.seen = true;
        // Dispatch action to update message seen status
        this.store.dispatch(updateMessageAction({ request: this.msg }));
      }
    }
  }
  messageTime(d: any) {
    if (!d) return null;
    let time = lastSeen(d);
    if (time === 'online') time = 'just now';
    return time;
  }
}
