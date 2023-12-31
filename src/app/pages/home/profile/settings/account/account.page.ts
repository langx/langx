import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { Store, select } from '@ngrx/store';
import { Models } from 'appwrite';

import { lastSeen } from 'src/app/extras/utils';
import { Account } from 'src/app/models/Account';
import { User } from 'src/app/models/User';
import { AuthService } from 'src/app/services/auth/auth.service';
import {
  listIdentitiesAction,
  listSessionsAction,
} from 'src/app/store/actions/auth.action';
import {
  accountSelector,
  currentUserSelector,
  identitiesSelector,
  sessionsSelector,
} from 'src/app/store/selectors/auth.selector';

@Component({
  selector: 'app-account',
  templateUrl: './account.page.html',
  styleUrls: ['./account.page.scss'],
})
export class AccountPage implements OnInit {
  account$: Observable<Account | null> = null;
  currentUser$: Observable<User> = null;
  identities$: Observable<Models.Identity[]> = null;
  sessions$: Observable<Models.Session[]> = null;

  constructor(private store: Store, private authService: AuthService) {}

  ngOnInit() {
    this.initValues();
  }

  initValues() {
    // Dispatch the action to list identities
    this.store.dispatch(listIdentitiesAction());
    this.store.dispatch(listSessionsAction());

    // Get Selectors
    this.account$ = this.store.pipe(select(accountSelector));
    this.currentUser$ = this.store.pipe(select(currentUserSelector));
    this.identities$ = this.store.pipe(select(identitiesSelector));
    this.sessions$ = this.store.pipe(select(sessionsSelector));
  }

  lastSeen(d: any) {
    if (!d) return null;
    return lastSeen(d);
  }

  // TODO: implement these methods
  disableAccount() {
    console.warn('disableAccount clicked');
    // TODO: implement this method
    // First show a modal to confirm the action
    // Then call the service to disable the account
  }
}
