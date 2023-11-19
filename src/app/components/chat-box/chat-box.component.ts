import { Component, Input, OnInit } from '@angular/core';

import { lastSeen } from 'src/app/extras/utils';
import { Message } from 'src/app/models/Message';

@Component({
  selector: 'app-chat-box',
  templateUrl: './chat-box.component.html',
  styleUrls: ['./chat-box.component.scss'],
})
export class ChatBoxComponent implements OnInit {
  @Input() chat: Message;
  @Input() current_user_id: string;

  constructor() {}

  ngOnInit() {}

  messageTime(d: any) {
    if (!d) return null;
    let time = lastSeen(d);
    if (time === 'online') time = 'just now';
    return time;
  }
}
