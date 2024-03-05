import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Store } from '@ngrx/store';
import { Observable, Subscription } from 'rxjs';

import { Streak } from 'src/app/models/Streaks';
import { User } from 'src/app/models/User';

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
    // Get all chat Rooms
    this.listVisits();
  }

  ionViewWillEnter() {
    this.subscription = new Subscription();

    // User Errors
    // this.subscription.add(
    //   this.store
    //     .pipe(select(errorSelector))
    //     .subscribe((error: ErrorInterface) => {
    //       if (error) {
    //         this.presentToast(error.message, 'danger');
    //         // TODO: Clear error message if it will be shown
    //       }
    //     })
    // );
  }

  ionViewWillLeave() {
    // Unsubscribe from all subscriptions
    // this.subscription.unsubscribe();
  }

  initValues() {
    // this.currentUser$ = this.store.pipe(select(currentUserSelector));
    // this.isLoading$ = this.store.pipe(select(isLoadingSelector));
    // this.streaks$ = this.store.pipe(select(streaksSelector));
    // this.total$ = this.store.pipe(select(totalSelector));
  }

  listVisits() {
    // Dispatch action to get all visits
    // this.store.dispatch(getVisitsAction());
  }

  //
  // Infinite Scroll
  //

  loadMore(event) {
    // Offset is the number of users already loaded
    // let offset: number = 0;
    // this.visits$
    //   .subscribe((visits) => {
    //     offset = visits.length;
    //     this.total$
    //       .subscribe((total) => {
    //         if (offset < total) {
    //           // console.log('offset', offset);
    //           // console.log('total', total);
    //           this.store.dispatch(
    //             getVisitsWithOffsetAction({
    //               request: {
    //                 offset,
    //               },
    //             })
    //           );
    //         } else {
    //           console.log('All visits loaded');
    //         }
    //       })
    //       .unsubscribe();
    //   })
    //   .unsubscribe();
    // event.target.complete();
  }

  //
  // Pull to refresh
  //

  handleRefresh(event) {
    this.listVisits();
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
