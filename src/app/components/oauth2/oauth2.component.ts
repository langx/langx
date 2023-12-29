import { Component, OnInit } from '@angular/core';
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
  constructor(private authService: AuthService) {}

  ngOnInit() {}

  oauth2State: string = JSON.stringify({
    success: environment.url.SUCCESS_OAUTH2,
    failure: environment.url.FAILURE_OAUTH2,
  });

  googleOptions: OAuth2AuthenticateOptions = {
    appId: environment.oauth.google.appID,
    authorizationBaseUrl: environment.oauth.google.base,
    redirectUrl: environment.oauth.google.uri,
    state: this.oauth2State,
    scope: 'email profile',
    responseType: 'code',
    logsEnabled: false,
    web: {
      windowTarget: '_self',
    },
    android: {},
    ios: {},
  };

  facebookOptions: OAuth2AuthenticateOptions = {
    appId: environment.oauth.facebook.appID,
    authorizationBaseUrl: environment.oauth.facebook.base,
    redirectUrl: environment.oauth.facebook.uri,
    state: this.oauth2State,
    scope: 'email',
    responseType: 'code',
    logsEnabled: true,
    web: {
      windowTarget: '_self',
    },
    android: {},
    ios: {},
  };

  appleOptions: OAuth2AuthenticateOptions = {
    appId: environment.oauth.apple.appID,
    authorizationBaseUrl: environment.oauth.apple.base,
    redirectUrl: environment.oauth.apple.uri,
    state: this.oauth2State,
    responseType: 'code',
    // responseMode: 'form_post',
    // scope: 'name email',
    logsEnabled: true,
    web: {
      windowTarget: '_self',
    },
    android: {},
    ios: {
      siwaUseScope: true,
    },
  };

  signInWithGoogle() {
    // OAuth2Client.authenticate(this.googleOptions)
    //   .then((result) => {
    //     console.log('signInWithGoogle result', result);
    //   })
    //   .catch((error) => {
    //     console.log('signInWithGoogle error', error);
    //   });
    this.authService.signInWithGoogle();
  }

  signInWithFacebook() {
    // OAuth2Client.authenticate(this.facebookOptions);
    this.authService.signInWithFacebook();
  }

  signInWithApple() {
    // OAuth2Client.authenticate(this.appleOptions)
    //   .then((result) => {
    //     console.log('signInWithApple result', result);
    //   })
    //   .catch((error) => {
    //     console.log('signInWithApple error', error);
    //   });
    this.authService.signInWithApple();
  }
}
