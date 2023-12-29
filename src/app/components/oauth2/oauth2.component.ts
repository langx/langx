import { Component, OnInit } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  OAuth2AuthenticateOptions,
  OAuth2Client,
} from '@byteowls/capacitor-oauth2';

import { environment } from 'src/environments/environment';
import { AuthService } from 'src/app/services/auth/auth.service';

@Component({
  selector: 'app-oauth2',
  templateUrl: './oauth2.component.html',
  styleUrls: ['./oauth2.component.scss'],
})
export class Oauth2Component implements OnInit {
  code: string;
  platform: string;

  constructor(private authService: AuthService) {}

  ngOnInit() {
    this.platform = Capacitor.getPlatform();
  }

  oauth2State: string = JSON.stringify({
    success: environment.url.SUCCESS_OAUTH2,
    failure: environment.url.FAILURE_OAUTH2,
  });

  googleOauth2Options: OAuth2AuthenticateOptions = {
    authorizationBaseUrl: environment.oauth.google.base,
    redirectUrl: environment.oauth.google.redirect,
    appId: environment.oauth.google.clientID,
    state: this.oauth2State,
    scope: 'email profile',
    responseType: 'code',
    logsEnabled: true,
    web: {
      windowTarget: '_self',
    },
    android: {},
    ios: {},
  };

  signInWithGoogle() {
    OAuth2Client.authenticate(this.googleOauth2Options)
      .then((response) => {
        this.code = response['code'];
        console.log('code: ', this.code);

        // go to backend
        console.log('OAuth success', response);
      })
      .catch((reason) => {
        console.error('OAuth rejected', reason);
      });
  }

  signInWithGoogle2() {
    this.authService.signInWithGoogle();
  }

  signInWithFacebook() {
    this.authService.signInWithFacebook();
  }

  signInWithApple() {
    this.authService.signInWithApple();
  }
}
