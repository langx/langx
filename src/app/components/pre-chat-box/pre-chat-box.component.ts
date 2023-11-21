import { Component, Input, OnInit } from '@angular/core';

import { createMessageRequestInterface } from 'src/app/models/types/requests/createMessageRequest.interface';

@Component({
  selector: 'app-pre-chat-box',
  templateUrl: './pre-chat-box.component.html',
  styleUrls: ['./pre-chat-box.component.scss'],
})
export class PreChatBoxComponent implements OnInit {
  @Input() chat: createMessageRequestInterface;

  msg: createMessageRequestInterface = null;

  constructor() {}

  ngOnInit() {
    this.msg = { ...this.chat };
  }
}
