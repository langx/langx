import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { getFlagEmoji, lastSeenExt } from 'src/app/extras/utils';
import { Account } from 'src/app/models/Account';
import { User } from 'src/app/models/User';

@Component({
  selector: 'app-aboutme-card',
  templateUrl: './aboutme-card.component.html',
  styleUrls: ['./aboutme-card.component.scss'],
})
export class AboutmeCardComponent implements OnInit {
  @Input() user: User;
  @Input() account: Account;

  gender: string;

  constructor(private router: Router) {}

  ngOnInit() {
    // Set others gender
    if (this.user?.gender === 'other') {
      this.gender = 'Prefer Not To Say';
    } else {
      this.gender = this.user?.gender;
    }
  }

  getAccountPage() {
    this.router.navigate(['/', 'home', 'account']);
  }

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
