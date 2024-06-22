import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable, Subscription } from 'rxjs';
import { Capacitor } from '@capacitor/core';

import { isLoggedInAction } from 'src/app/store/actions/auth.action';
import {
  isLoadingSelector,
  isLoggedInSelector,
  unauthorizedErrorSelector,
} from 'src/app/store/selectors/auth.selector';

@Component({
  selector: 'app-success',
  templateUrl: './success.page.html',
  styleUrls: ['./success.page.scss'],
})
export class SuccessPage implements OnInit {
  subscription: Subscription;

  isLoggedIn$: Observable<boolean>;
  isLoading$: Observable<boolean>;

  modelSuccess = {
    success: true,
    title: "Success! You've logged in.",
    color: 'success',
    icon: 'shield-checkmark-outline',
  };

  modelFailed = {
    success: false,
    title: 'Unfortunately, we were unable to log in your provider.',
    color: 'danger',
    icon: 'close-outline',
  };

  constructor(
    private store: Store,
    private route: ActivatedRoute,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    await this.initValues();
  }

  ionViewWillEnter() {
    this.subscription = new Subscription();

    // Error Handling
    this.subscription.add(
      this.store.pipe(select(unauthorizedErrorSelector)).subscribe((error) => {
        if (error) {
          this.presentToast(error.message, 'warning');
        }
      })
    );
  }

  ionViewWillLeave() {
    // Unsubscribe from all subscriptions
    this.subscription.unsubscribe();
  }

  async initValues() {
    // Get Selectors
    this.isLoggedIn$ = this.store.pipe(select(isLoggedInSelector));
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));

    // Set Params
    const params = this.route.snapshot.queryParamMap;

    const cookieFallback = {};
    const key = params.get('key');
    const secret = params.get('secret');

    if (key) {
      cookieFallback[key] = secret;
    }

    const cookieValue = JSON.stringify(cookieFallback);

    if (
      cookieFallback &&
      Object.keys(cookieFallback).length !== 0 &&
      Capacitor.isNativePlatform()
    ) {
      localStorage.setItem('cookieFallback', cookieValue);
    }

    this.store.dispatch(isLoggedInAction());
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
