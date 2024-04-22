import { Component, Input, OnInit } from '@angular/core';

import {
  getAge,
  getFlagEmoji,
  lastSeen,
  lastSeenExt,
} from 'src/app/extras/utils';

import { User } from 'src/app/models/User';

@Component({
  selector: 'app-pp-card',
  templateUrl: './pp-card.component.html',
  styleUrls: ['./pp-card.component.scss'],
})
export class PpCardComponent implements OnInit {
  @Input() currentUser: User;

  constructor() {}

  ngOnInit() {
    console.log(this.currentUser);
  }

  //
  // Utils
  //

  lastSeen(d: any) {
    if (!d) return null;
    return lastSeen(d);
  }

  lastSeenExt(d: any) {
    if (!d) return null;
    return lastSeenExt(d);
  }

  getAge(d: any) {
    if (!d) return null;
    return getAge(d);
  }

  getFlagEmoji(item: User) {
    return getFlagEmoji(item);
  }
}
