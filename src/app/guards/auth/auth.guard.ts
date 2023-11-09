import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Store, select } from '@ngrx/store';
import { Observable, filter, tap } from 'rxjs';

import { NotificationService } from 'src/app/services/notification/notification.service';
import { isLoggedInAction } from 'src/app/store/actions/auth.action';
import { isLoggedInSelector } from 'src/app/store/selectors/auth.selector';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(
    private router: Router,
    private notification: NotificationService,
    private store: Store
  ) {}

  canActivate(): Observable<boolean> {
    this.store.dispatch(isLoggedInAction());
    return this.store.pipe(
      select(isLoggedInSelector),
      filter((isLoggedIn) => isLoggedIn !== null), // ignore values until isLoggedIn is not null
      tap((isLoggedIn) => {
        console.log('isLoggedIn', isLoggedIn);
        if (!isLoggedIn) {
          this.navigate('/login');
        } else {

          // TODO: Notification Service
          // this.startListener();
        }
      })
    );
  }

  navigate(url: string) {
    this.router.navigateByUrl(url, { replaceUrl: true });
  }

  startListener() {
    this.notification.listen();
    console.log('Notification Service started');
  }
}
