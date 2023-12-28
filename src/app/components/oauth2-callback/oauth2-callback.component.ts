import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';

import { ApiService } from 'src/app/services/api/api.service';
import { AuthService } from 'src/app/services/auth/auth.service';

@Component({
  selector: 'app-oauth2-callback',
  templateUrl: './oauth2-callback.component.html',
  styleUrls: ['./oauth2-callback.component.scss'],
})
export class Oauth2CallbackComponent implements OnInit {
  params: Params;
  token: string = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private api: ApiService
  ) {}

  async ngOnInit() {
    this.initValues();
  }

  initValues() {
    // Set Params
    this.params = this.route.snapshot.queryParams;
    console.log('params: ', this.params);

    if (this.params['jwt']) {
      this.token = this.params['jwt'];
      console.log('jwt: ', this.token);
      console.log('redirect to mobile app');

      this.navigateWithToken();
    } else {
      // Check session
      this.checkSession()
        .then(async (response) => {
          console.log('session: ', response);
          this.token = (await this.createJWT()).jwt;
          console.log('creating new jwt..');
          console.log('jwt: ', this.token);
          console.log('redirect to web app');

          this.navigateWithToken();
        })
        .catch((error) => {
          console.log('error: ', error);
          console.log('There is no user session. Redirect to login page.');
        });
    }
  }

  checkSession() {
    return this.api.account.getSession('current');
  }

  createJWT() {
    return this.authService.createJWT();
  }

  navigateWithToken() {
    window.location.href = `tech.newchapter.languagexchange:/login/oauth2/${this.token}`;
    // If it is in web browser, redirect to home page
    setTimeout(() => {
      this.navigateToHome();
    }, 2500);
  }

  navigateToHome() {
    this.router.navigateByUrl('/home');
  }
}
