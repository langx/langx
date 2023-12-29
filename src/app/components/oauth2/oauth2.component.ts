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

  // TODO: Delete here
  // webState: string = JSON.stringify({
  //   success: 'https://app.languagexchange.net/home',
  //   failure: 'https://app.languagexchange.net/login',
  // });

  // TODO: Use environment variable here
  oauth2State: string = JSON.stringify({
    success: 'https://app.languagexchange.net/login/oauth2-callback',
    failure: 'https://app.languagexchange.net/login',
  });

  googleOauth2Options: OAuth2AuthenticateOptions = {
    authorizationBaseUrl: 'https://accounts.google.com/o/oauth2/auth',
    redirectUrl:
      'https://db.languagexchange.net/v1/account/sessions/oauth2/callback/google/650750d21e4a6a589be3',
    state: this.oauth2State,
    appId: environment.oauth.google.clientID,
    scope: 'email profile',
    logsEnabled: true,
    responseType: 'code',
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
    this.authService.signInWithGoogle(this.platform);
  }

  signInWithFacebook() {
    this.authService.signInWithFacebook(this.platform);
  }

  signInWithApple() {
    this.authService.signInWithApple(this.platform);
  }
}
