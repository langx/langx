import { Injectable } from '@angular/core';
import { CanLoad, Router } from '@angular/router';
import { Auth2Service } from 'src/app/services/auth/auth2.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanLoad {
  constructor(private auth2Service: Auth2Service, private router: Router) {}

  async canLoad(): Promise<boolean> {
    try {
      const isLoggedIn = await this.auth2Service.isLoggedIn();
      // console.log('GUARD canLoad, user:', user);
      if (isLoggedIn) {
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
}
