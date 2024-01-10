import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

import { isLoggedInSelector } from 'src/app/store/selectors/auth.selector';

@Component({
  selector: 'app-not-found',
  templateUrl: './not-found.page.html',
  styleUrls: ['./not-found.page.scss'],
})
export class NotFoundPage implements OnInit {
  isLoggedIn$: Observable<boolean>;

  modelSuccess = {
    success: true,
    title: 'Page not found! Redirecting you to the home page now.',
    color: 'success',
    icon: 'shield-checkmark-outline',
  };

  modelFailed = {
    success: false,
    title: "We couldn't find your authentication information.",
    color: 'danger',
    icon: 'close-outline',
  };

  constructor(private store: Store, private router: Router) {}

  ngOnInit() {
    this.isLoggedIn$ = this.store.pipe(select(isLoggedInSelector));
    this.isLoggedIn$
      .subscribe((isLoggedIn) => {
        this.redirect(isLoggedIn);
      })
      .unsubscribe();
  }

  redirect(isLoggedIn: boolean) {
    setTimeout(() => {
      if (!isLoggedIn) {
        this.router.navigateByUrl('/');
      } else {
        this.router.navigateByUrl('/home');
      }
    }, 3000);
  }
}
