import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable, Subscription, combineLatest, filter } from 'rxjs';

import { isLoggedInAction } from 'src/app/store/actions/auth.action';
import {
  isCompletedRegistrationSelector,
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
    private router: Router,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    await this.initValues();
  }

  ionViewWillEnter() {
    this.subscription = new Subscription();

    // Redirect to the correct page
    this.subscription.add(
      combineLatest([
        this.store.pipe(
          select(isLoggedInSelector),
          filter((isLoggedIn) => isLoggedIn !== null) // ignore values until isLoggedIn is not null
        ),
        this.store.pipe(
          select(isCompletedRegistrationSelector),
          filter((isCompletedRegistration) => isCompletedRegistration !== null)
        ),
      ]).subscribe(([isLoggedIn, isCompletedRegistration]) => {
        // console.log('isLoggedIn', isLoggedIn);
        // console.log('isCompletedRegistration', isCompletedRegistration);

        setTimeout(() => {
          if (!isLoggedIn) {
            this.router.navigateByUrl('/login');
          } else if (!isCompletedRegistration) {
            this.router.navigateByUrl('/signup/complete');
          } else {
            this.router.navigateByUrl('/home');
          }
        }, 3000);
      })
    );

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
    console.log('cookieValue: ', cookieValue);

    localStorage.setItem('cookieFallback', cookieValue);

    this.store.dispatch(isLoggedInAction());
  }

  //
  // Present Toast
  //

  async presentToast(msg: string, color?: string) {
    const toast = await this.toastController.create({
      message: msg,
      color: color || 'primary',
      duration: 1500,
      position: 'bottom',
    });

    await toast.present();
  }
}
