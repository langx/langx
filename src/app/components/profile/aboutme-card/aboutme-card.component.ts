import { Component, Input, OnInit } from '@angular/core';
import { getFlagEmoji, lastSeenExt } from 'src/app/extras/utils';

import { User } from 'src/app/models/User';

@Component({
  selector: 'app-aboutme-card',
  templateUrl: './aboutme-card.component.html',
  styleUrls: ['./aboutme-card.component.scss'],
})
export class AboutmeCardComponent implements OnInit {
  @Input() currentUser: User;

  constructor() {}

  ngOnInit() {}

  //
  // Utils
  //

  lastSeenExt(d: any) {
    if (!d) return null;
    return lastSeenExt(d);
  }

  getFlagEmoji(item: User) {
    return getFlagEmoji(item);
  }
}
