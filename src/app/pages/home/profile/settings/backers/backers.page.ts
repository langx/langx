import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable, Subscription, map } from 'rxjs';

import { User } from 'src/app/models/User';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { getSponsorsAction } from 'src/app/store/actions/sponsors.action';
import {
  errorSelector,
  isLoadingSelector,
  totalSelector,
  usersSelector,
} from 'src/app/store/selectors/sponsors.selector';

@Component({
  selector: 'app-backers',
  templateUrl: './backers.page.html',
  styleUrls: ['./backers.page.scss'],
})
export class BackersPage implements OnInit {
  subscription: Subscription;

  isLoading$: Observable<boolean> = null;
  total$: Observable<number | null> = null;
  users$: Observable<User[] | null> = null;

  model = {
    icon: 'heart-outline',
    title: 'No Sponsor Yet',
    subTitle: 'You can be our first sponsor.',
    color: 'danger',
  };

  constructor(
    private store: Store,
    private router: Router,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.initValues();
    // Get all chat Rooms
    this.listSponsors();
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
            // TODO: Clear error message if it will be shown
          }
        })
    );
  }

  ionViewWillLeave() {
    // Unsubscribe from all subscriptions
    this.subscription.unsubscribe();
  }

  initValues() {
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));
    this.total$ = this.store.pipe(select(totalSelector));
    this.users$ = this.store.pipe(select(usersSelector));
  }

  listSponsors() {
    // Dispatch action to get all contributors
    this.store.dispatch(getSponsorsAction());
  }

  //
  // Routes
  //

  getProfilePage(userId: string) {
    this.router.navigateByUrl('/home/user/' + userId);
  }

  //
  // Pull to refresh
  //

  handleRefresh(event) {
    this.listSponsors();
    if (event) event.target.complete();
  }

  //
  // Utils
  //

  isEmpty$(): Observable<boolean> {
    return this.total$.pipe(map((total) => total === 0));
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
