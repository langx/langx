import { Component, OnInit } from '@angular/core';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';
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
  refreshIntervalId: any;

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

    // Init Badge
    await this.checkBadgeSeen();
    await this.initBadge();
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
    console.log('Presence Service started');
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
