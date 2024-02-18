import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable, Subscription, map } from 'rxjs';

import { User } from 'src/app/models/User';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { getContributorsAction } from 'src/app/store/actions/contributors.action';
import {
  errorSelector,
  isLoadingSelector,
  usersSelector,
} from 'src/app/store/selectors/contributors.selector';

@Component({
  selector: 'app-contributors',
  templateUrl: './contributors.page.html',
  styleUrls: ['./contributors.page.scss'],
})
export class ContributorsPage implements OnInit {
  subscription: Subscription;

  isLoading$: Observable<boolean> = null;
  users$: Observable<User[] | null> = null;

  model = {
    icon: 'people-outline',
    title: 'No Contributors Yet',
    subTitle:
      "If you're interested in, please reach out to our user relations.",
    color: 'warning',
  };

  constructor(
    private store: Store,
    private router: Router,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.initValues();
    // Get all chat Rooms
    this.listContributors();
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
    this.users$ = this.store.pipe(select(usersSelector));
  }

  listContributors() {
    // Dispatch action to get all contributors
    this.store.dispatch(getContributorsAction());
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
    this.listContributors();
    if (event) event.target.complete();
  }

  //
  // Utils
  //

  isEmpty(contributeType: string): Observable<boolean> {
    return this.users$.pipe(
      map(
        (users) => !users.some((user) => user.contributors.includes('design'))
      )
    );
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
