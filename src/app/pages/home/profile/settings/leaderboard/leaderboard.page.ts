import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable, Subscription, take } from 'rxjs';

import { Streak } from 'src/app/models/Streak';
import { User } from 'src/app/models/User';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';
import {
  getStreaksAction,
  getStreaksWithOffsetAction,
  clearErrorsAction,
} from 'src/app/store/actions/streaks.action';
import {
  errorSelector,
  isLoadingSelector,
  streaksSelector,
  totalSelector,
} from 'src/app/store/selectors/streaks.selector';

@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.page.html',
  styleUrls: ['./leaderboard.page.scss'],
})
export class LeaderboardPage implements OnInit {
  subscription: Subscription;

  currentUser$: Observable<User | null> = null;
  isLoading$: Observable<boolean> = null;
  streaks$: Observable<Streak[] | null> = null;
  total$: Observable<number | null> = null;

  constructor(private store: Store, private toastController: ToastController) {}

  ngOnInit() {
    this.initValues();
    // Get all Streaks
    this.listStreaks();
  }

  ionViewWillEnter() {
    this.subscription = new Subscription();

    // User Errors
    this.subscription.add(
      this.store
        .pipe(select(errorSelector))
        .subscribe((error: ErrorInterface) => {
          if (error) {
            this.presentToast(error.message, 'danger');
            this.store.dispatch(clearErrorsAction());
          }
        })
    );
  }

  ionViewWillLeave() {
    // Unsubscribe from all subscriptions
    this.subscription.unsubscribe();
  }

  initValues() {
    this.currentUser$ = this.store.pipe(select(currentUserSelector));
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));
    this.streaks$ = this.store.pipe(select(streaksSelector));
    this.total$ = this.store.pipe(select(totalSelector));
  }

  listStreaks() {
    // Dispatch action to get all visits
    this.store.dispatch(getStreaksAction());
  }

  //
  // Infinite Scroll
  //

  loadMore(event) {
    this.streaks$.pipe(take(1)).subscribe((visits) => {
      const offset = visits.length;
      this.total$.pipe(take(1)).subscribe((total) => {
        if (offset < 100) {
          this.store.dispatch(
            getStreaksWithOffsetAction({
              request: {
                offset,
              },
            })
          );
        } else {
          console.log('All streaks loaded');
        }
      });
    });
    event.target.complete();
  }

  //
  // Pull to refresh
  //

  handleRefresh(event) {
    this.listStreaks();
    if (event) event.target.complete();
  }

  //
  // Present Toast
  //

  async presentToast(msg: string, color?: string) {
    const toast = await this.toastController.create({
      message: msg,
      color: color || 'primary',
      duration: 1000,
      position: 'top',
    });

    await toast.present();
  }
}
