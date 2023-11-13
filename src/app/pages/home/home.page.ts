import { Component, OnInit } from '@angular/core';
import { LoadingController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { combineLatest, map } from 'rxjs';

import { NotificationService } from 'src/app/services/notification/notification.service';
import { isLoadingSelector as isLoadingUser } from 'src/app/store/selectors/user.selector';
import { isLoadingSelector as isLoadingRoom } from 'src/app/store/selectors/room.selector';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {
  loadingOverlay: HTMLIonLoadingElement;

  constructor(
    private store: Store,
    private notification: NotificationService,
    private loadingCtrl: LoadingController
  ) {}

  async ngOnInit() {
    this.initValues();
  }

  ngOnDestroy() {
    // this.unsubscribeListener();
  }

  initValues() {
    // Loading Controller
    combineLatest([
      this.store.pipe(select(isLoadingUser)),
      this.store.pipe(select(isLoadingRoom)),
    ])
      .pipe(
        map(([isLoadingUser, isLoadingRoom]) => isLoadingUser || isLoadingRoom)
      )
      .subscribe((isLoading) => {
        this.loadingController(isLoading);
      });
  }

  unsubscribeListener() {
    this.notification.unsubscribe();
    console.log('Notification Service stopped');
  }

  //
  // Loading Controller
  //

  async loadingController(isLoading: boolean) {
    if (isLoading) {
      if (!this.loadingOverlay || !this.loadingOverlay.present) {
        this.loadingOverlay = await this.loadingCtrl.create({
          message: 'Please wait...',
        });
        await this.loadingOverlay.present();
      }
    } else if (this.loadingOverlay && this.loadingOverlay.present) {
      await this.loadingOverlay.dismiss();
      this.loadingOverlay = undefined;
    }
  }
}
