import { Component, OnInit } from '@angular/core';
import { LoadingController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable, combineLatest, map, tap } from 'rxjs';

import { NotificationService } from 'src/app/services/notification/notification.service';
import { Account } from 'src/app/models/Account';
import {
  accountSelector,
  totalUnseenSelector,
} from 'src/app/store/selectors/auth.selector';
import { updatePresenceAction } from 'src/app/store/actions/presence.action';
import { isLoadingSelector as isLoadingUser } from 'src/app/store/selectors/user.selector';
import { isLoadingSelector as isLoadingRoom } from 'src/app/store/selectors/room.selector';

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
    private notification: NotificationService,
    private loadingCtrl: LoadingController
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

    // Loading Controller
    combineLatest([
      this.store.pipe(select(isLoadingUser)),
      this.store.pipe(select(isLoadingRoom)),
    ])
      .pipe(
        map(([isLoadingUser, isLoadingRoom]) => isLoadingUser || isLoadingRoom)
      )
      .subscribe((isLoading) => {
        // TODO: #258 Loading Controller is frozen
        // this.loadingController(isLoading);
      });
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

  //
  // Loading Controller
  //

  private loadingOverlay: HTMLIonLoadingElement;
  private isLoadingOverlayActive = false;
  async loadingController(isLoading: boolean) {
    if (isLoading) {
      if (!this.loadingOverlay && !this.isLoadingOverlayActive) {
        this.isLoadingOverlayActive = true;
        this.loadingOverlay = await this.loadingCtrl.create({
          message: 'Please wait...',
        });
        await this.loadingOverlay.present();
        this.isLoadingOverlayActive = false;
      }
    } else if (
      this.loadingOverlay &&
      this.loadingOverlay.present &&
      !this.isLoadingOverlayActive
    ) {
      this.isLoadingOverlayActive = true;
      await this.loadingOverlay.dismiss();
      this.loadingOverlay = undefined;
      this.isLoadingOverlayActive = false;
    }
  }
}
