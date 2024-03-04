import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Browser } from '@capacitor/browser';
import { IonContent, ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable, Subscription, map } from 'rxjs';

import { environment } from 'src/environments/environment';
import { User } from 'src/app/models/User';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { getContributorsAction } from 'src/app/store/actions/contributors.action';
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';
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
  @ViewChild(IonContent) content: IonContent;

  subscription: Subscription;

  isLoading$: Observable<boolean> = null;
  currentUser$: Observable<User> = null;
  users$: Observable<User[] | null> = null;

  model = {
    icon: 'people-outline',
    title: 'No Contributors Yet',
    subTitle:
      "If you're interested, please join our team using the link at the bottom of this page.",
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
    this.currentUser$ = this.store.pipe(select(currentUserSelector));
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

  async openDiscordPage() {
    await Browser.open({ url: environment.ext.socialMedia.discord });
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

  isEmpty$(contributeType: string): Observable<boolean> {
    return this.users$.pipe(
      map(
        (users) =>
          !users.some((user) => user.contributors.includes(contributeType))
      )
    );
  }

  scrollToBottom() {
    this.content.scrollToBottom(300);
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
