import { Injectable } from '@angular/core';
import { Store, select } from '@ngrx/store';
import { Observable, filter } from 'rxjs';
import {
  ActivatedRouteSnapshot,
  CanLoad,
  Router,
  UrlTree,
} from '@angular/router';

import { NotificationService } from 'src/app/services/notification/notification.service';
import { isLoggedInAction } from 'src/app/store/actions/auth.action';
import { isLoggedInSelector } from 'src/app/store/selectors/auth.selector';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanLoad {
  constructor(
    private router: Router,
    private notification: NotificationService,
    private store: Store
  ) {}

  canLoad(next: ActivatedRouteSnapshot): Observable<boolean | UrlTree> {
    return new Observable((observer) => {
      // TODO: Disable this console.log
      console.log('AuthGuard');
      this.store.dispatch(isLoggedInAction());
      this.store
        .pipe(
          select(isLoggedInSelector),
          filter((isLoggedIn) => isLoggedIn !== null) // ignore values until isLoggedIn is not null
        )
        .subscribe((isLoggedIn) => {
          console.log('isLoggedIn', isLoggedIn);
          if (!isLoggedIn) {
            observer.next(this.router.parseUrl('/login'));
          } else {
            // TODO: Notification Service
            this.startListener();
            observer.next(true);
          }
          observer.complete();
        });
    });
  }

  navigate(url: string) {
    this.router.navigateByUrl(url, { replaceUrl: true });
  }

  startListener() {
    this.notification.listen();
    console.log('Notification Service started');
  }
}
