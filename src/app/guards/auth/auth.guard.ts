import { Injectable } from '@angular/core';
import { CanActivate, CanLoad, Router } from '@angular/router';
import { Store } from '@ngrx/store';

import { AuthService } from 'src/app/services/auth/auth.service';
import { NotificationService } from 'src/app/services/notification/notification.service';
import { isLoggedInAction } from 'src/app/store/actions/auth.action';

@Injectable({
  providedIn: 'root',
})
// TODO: 'CanLoad' is deprecated.ts(6385)
// Idea: CanMatch
export class AuthGuard implements CanActivate, CanLoad {
  constructor(
    private authService: AuthService,
    private router: Router,
    private notification: NotificationService,
    private store: Store
  ) {}

  async canActivate(): Promise<boolean> {
    this.store.dispatch(isLoggedInAction());

    try {
      const isLoggedIn = await this.authService.isLoggedIn();
      if (isLoggedIn) {
        this.startListener();
        return true;
      } else {
        this.navigate('/login');
        return false;
      }
    } catch (e) {
      console.log(e);
      this.navigate('/login');
      return false;
    }
  }

  async canLoad(): Promise<boolean> {
    try {
      const isLoggedIn = await this.authService.isLoggedIn();
      if (isLoggedIn) {
        // this.startListener();
        return true;
      } else {
        this.navigate('/login');
        return false;
      }
    } catch (e) {
      console.log(e);
      this.navigate('/login');
      return false;
    }
  }

  navigate(url: string) {
    this.router.navigateByUrl(url, { replaceUrl: true });
  }

  startListener() {
    this.notification.listen();
    console.log('Notification Service started');
  }
}
