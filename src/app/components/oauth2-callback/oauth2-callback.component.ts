import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';

import { ApiService } from 'src/app/services/api/api.service';
import { AuthService } from 'src/app/services/auth/auth.service';

@Component({
  selector: 'app-oauth2-callback',
  templateUrl: './oauth2-callback.component.html',
  styleUrls: ['./oauth2-callback.component.scss'],
})
export class Oauth2CallbackComponent implements OnInit {
  params: Params;

  constructor(
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
      console.log('jwt: ', this.params['jwt']);
      console.log('redirect to mobile app');
    } else {
      // Check session
      this.checkSession()
        .then((response) => {
          console.log('session: ', response);
          const jwt = this.createJWT();
          console.log('creating new jwt..');
          console.log('jwt: ', jwt);
          console.log('redirect to web app');
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
}
