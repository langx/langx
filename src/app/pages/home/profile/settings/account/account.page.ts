import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { Store, select } from '@ngrx/store';

import { lastSeen } from 'src/app/extras/utils';
import { AuthService } from 'src/app/services/auth/auth.service';
import {
  accountSelector,
  currentUserSelector,
} from 'src/app/store/selectors/auth.selector';
import { Account } from 'src/app/models/Account';
import { User } from 'src/app/models/User';

@Component({
  selector: 'app-account',
  templateUrl: './account.page.html',
  styleUrls: ['./account.page.scss'],
})
export class AccountPage implements OnInit {
  account$: Observable<Account | null> = null;
  currentUser$: Observable<User> = null;

  constructor(private store: Store, private authService: AuthService) {}

  ngOnInit() {
    this.initValues();
  }

  initValues() {
    this.account$ = this.store.pipe(select(accountSelector));
    this.currentUser$ = this.store.pipe(select(currentUserSelector));
  }

  lastSeen(d: any) {
    if (!d) return null;
    return lastSeen(d);
  }

  // TODO: implement these methods
  disableAccount() {
    console.warn('disableAccount clicked');
  }
}
