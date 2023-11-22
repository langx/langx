import { Component, Input, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';

import { tempMessageInterface } from 'src/app/models/types/tempMessage.interface';
import {
  removeMessageFromTempMessagesAction,
  resendMessageFromTempMessagesAction,
} from 'src/app/store/actions/message.action';

@Component({
  selector: 'app-pre-chat-box',
  templateUrl: './pre-chat-box.component.html',
  styleUrls: ['./pre-chat-box.component.scss'],
})
export class PreChatBoxComponent implements OnInit {
  @Input() tempMsg: tempMessageInterface | null;

  constructor(private store: Store) {}

  ngOnInit() {}

  resendMessage() {
    this.store.dispatch(
      resendMessageFromTempMessagesAction({ request: this.tempMsg })
    );
  }

  deleteMessage() {
    this.store.dispatch(
      removeMessageFromTempMessagesAction({ payload: this.tempMsg })
    );
  }
}
