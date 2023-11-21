import { Component, Input, OnInit } from '@angular/core';

import { tempMessageInterface } from 'src/app/models/types/tempMessage.interface';

@Component({
  selector: 'app-pre-chat-box',
  templateUrl: './pre-chat-box.component.html',
  styleUrls: ['./pre-chat-box.component.scss'],
})
export class PreChatBoxComponent implements OnInit {
  @Input() tempMsg: tempMessageInterface | null;

  constructor() {}

  ngOnInit() {}
}
