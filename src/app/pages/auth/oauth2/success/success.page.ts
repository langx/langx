import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Store, select } from '@ngrx/store';
import { Observable, Subscription, combineLatest, filter } from 'rxjs';

import { isLoggedInAction } from 'src/app/store/actions/auth.action';
import {
  isCompletedRegistrationSelector,
  isLoadingSelector,
  isLoggedInSelector,
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
    private router: Router
  ) {}

  async ngOnInit() {
    await this.initValues();
  }

  ionViewWillEnter() {
    this.subscription = new Subscription();

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
}
