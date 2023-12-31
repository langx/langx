import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Store, select } from '@ngrx/store';
import { Subscription, filter } from 'rxjs';

import { isLoggedInAction } from 'src/app/store/actions/auth.action';
import { isLoggedInSelector } from 'src/app/store/selectors/auth.selector';

@Component({
  selector: 'app-oauth2-callback',
  templateUrl: './oauth2-callback.component.html',
  styleUrls: ['./oauth2-callback.component.scss'],
})
export class Oauth2CallbackComponent implements OnInit {
  subscription: Subscription;

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
      this.store
        .pipe(
          select(isLoggedInSelector),
          filter((isLoggedIn) => isLoggedIn !== null) // ignore values until isLoggedIn is not null
        )
        .subscribe((isLoggedIn) => {
          console.log('isLoggedIn', isLoggedIn);
          if (!isLoggedIn) {
            this.router.navigateByUrl('/login');
          } else {
            this.router.navigateByUrl('/home');
          }
        })
    );
  }

  ionViewWillLeave() {
    // Unsubscribe from all subscriptions
    this.subscription.unsubscribe();
  }

  async initValues() {
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
