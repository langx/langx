import { Component, OnInit } from '@angular/core';
import { Store, select } from '@ngrx/store';
import { Observable, Subscription, interval, tap } from 'rxjs';
import { Preferences } from '@capacitor/preferences';
import { ModalController } from '@ionic/angular';

import { NewBadgeComponent } from 'src/app/components/new-badge/new-badge.component';
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
  listenerFn: any;

  presencePing$: Subscription;

  totalUnseen$: Observable<number>;
  currentUser$: Observable<Account>;

  badgeSeen: boolean = false;

  constructor(
    private store: Store,
    private notification: NotificationService,
    private modalCtrl: ModalController
  ) {}

  async ngOnInit() {
    this.initValues();
    this.presencePing();

    // Start listening to notifications
    this.startListener();

    // Init Badge
    await this.checkBadgeSeen();
    await this.initBadge();
  }

  ngOnDestroy() {
    this.unsubscribeListener(); // Stop presence ping
  }

  startListener() {
    if (!this.listenerFn) {
      this.listenerFn = this.notification.connect();
    }
  }

  initValues() {
    this.currentUser$ = this.store.pipe(select(accountSelector));
    this.totalUnseen$ = this.store.pipe(select(totalUnseenSelector));
  }

  unsubscribeListener() {
    // Stop presence ping
    this.presencePing$.unsubscribe();
    // console.log('Presence Service stopped');

    // Stop listening to notifications
    if (this.listenerFn) {
      this.listenerFn();
      this.listenerFn = null;
      console.log('Notification listener stopped');
    }

    // HARD RELOAD
    // location.reload();
  }

  //
  // Presence Ping
  //

  presencePing() {
    // Update user in user collection lastSeen attribute
    // console.log('Presence Service started');
    this.dispatchUpdatePresence();

    // Create an Observable that emits a value every 60 seconds
    this.presencePing$ = interval(1000 * 4)
      .pipe(tap(() => this.dispatchUpdatePresence()))
      .subscribe();
  }

  dispatchUpdatePresence() {
    this.store.dispatch(
      updatePresenceAction({
        request: { lastSeen: new Date() },
      })
    );
  }

  //
  // Badge
  //

  async initBadge() {
    if (this.badgeSeen) return;
    const modal = await this.modalCtrl.create({
      component: NewBadgeComponent,
      componentProps: {
        onFinish: async () => {
          await this.setBadgeSeen(true);
          modal.dismiss();
        },
      },
    });

    return await modal.present();
  }

  async checkBadgeSeen() {
    await Preferences.get({ key: 'early-adopter' }).then((res) => {
      res && res.value
        ? (this.badgeSeen = JSON.parse(res.value))
        : (this.badgeSeen = false);
    });
  }

  async setBadgeSeen(value: boolean) {
    await Preferences.set({
      key: 'early-adopter',
      value: JSON.stringify(value),
    });
    this.badgeSeen = value;
  }
}
