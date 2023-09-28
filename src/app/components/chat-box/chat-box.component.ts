import { Component, Input, OnInit } from '@angular/core';
import { lastSeen } from 'src/app/extras/utils';

@Component({
  selector: 'app-chat-box',
  templateUrl: './chat-box.component.html',
  styleUrls: ['./chat-box.component.scss'],
})
export class ChatBoxComponent implements OnInit {
  @Input() chat: any;
  @Input() current_user_id: any;

  constructor() {}

  ngOnInit() {}

  lastSeen(d: any) {
    if (!d) return null;
    return lastSeen(d);
  }
}
