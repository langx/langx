import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth/auth.service';
import { NotificationService } from 'src/app/services/notification/notification.service';

@Injectable({
  providedIn: 'root',
})
// TODO: 'CanLoad' is deprecated.ts(6385)
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router,
    private notification: NotificationService
  ) {}

  async canActivate(): Promise<boolean> {
    try {
      const isLoggedIn = await this.authService.isLoggedIn();
      // console.log('GUARD canLoad, user:', user);
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

  navigate(url) {
    this.router.navigateByUrl(url, { replaceUrl: true });
  }

  startListener() {
    this.notification.listen();
    console.log('Notification Service started');
  }
}
