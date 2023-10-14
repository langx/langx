import { Injectable } from '@angular/core';
import { CanLoad, Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth/auth.service';

@Injectable({
  providedIn: 'root',
})
// TODO: 'CanLoad' is deprecated.ts(6385)
export class LoginGuard implements CanLoad {
  constructor(private authService: AuthService, private router: Router) {}

  async canLoad(): Promise<boolean> {
    try {
      const isLoggedIn = await this.authService.isLoggedIn();
      // console.log('GUARD canLoad, user:', user);
      if (!isLoggedIn) {
        return true;
      } else {
        this.navigate('/home');
        return false;
      }
    } catch (e) {
      // TODO: Test here
      console.log(e);
      this.navigate('/login');
      return true;
    }
  }

  navigate(url) {
    this.router.navigateByUrl(url, { replaceUrl: true });
  }
}
