import { Component, OnInit } from '@angular/core';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

import { NotificationService } from 'src/app/services/notification/notification.service';
import { Account } from 'src/app/models/Account';
import { updatePresenceAction } from 'src/app/store/actions/presence.action';
import {
  accountSelector,
  totalUnseenSelector,
} from 'src/app/store/selectors/auth.selector';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {
  refreshIntervalId: any;

  totalUnseen$: Observable<number>;
  currentUser$: Observable<Account>;

  constructor(
    private store: Store,
    private notification: NotificationService
  ) {}

  async ngOnInit() {
    this.initValues();
    this.presencePing();
  }

  ngOnDestroy() {
    this.unsubscribeListener();
    // Kill presence ping
    clearInterval(this.refreshIntervalId);
  }

  initValues() {
    this.currentUser$ = this.store.pipe(select(accountSelector));
    this.totalUnseen$ = this.store.pipe(select(totalUnseenSelector));
  }

  unsubscribeListener() {
    this.notification.unsubscribe();
    console.log('Notification Service stopped');
  }

  //
  // Presence Ping
  //

  presencePing() {
    // Update user in user collection lastSeen attribute
    this.dispatchUpdatePresence();
    this.refreshIntervalId = setInterval(() => {
      this.dispatchUpdatePresence();
    }, 60000);
  }

  dispatchUpdatePresence() {
    this.currentUser$
      .subscribe((user) => {
        this.store.dispatch(
          updatePresenceAction({
            currentUserId: user.$id,
            request: { lastSeen: new Date() },
          })
        );
      })
      .unsubscribe();
  }
}
