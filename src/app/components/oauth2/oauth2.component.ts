import { Component, OnInit } from '@angular/core';
import {
  OAuth2AuthenticateOptions,
  OAuth2Client,
} from '@byteowls/capacitor-oauth2';

import { ApiService } from 'src/app/services/api/api.service';
import { AuthService } from 'src/app/services/auth/auth.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-oauth2',
  templateUrl: './oauth2.component.html',
  styleUrls: ['./oauth2.component.scss'],
})
export class Oauth2Component implements OnInit {
  accessToken: string;

  constructor(private api: ApiService, private authService: AuthService) {}

  ngOnInit() {}

  oauth2Options: OAuth2AuthenticateOptions = {
    authorizationBaseUrl: 'https://accounts.google.com/o/oauth2/auth',
    accessTokenEndpoint: 'https://www.googleapis.com/oauth2/v4/token',
    scope: 'email profile',
    resourceUrl: 'https://www.googleapis.com/userinfo/v2/me',
    logsEnabled: false,
    web: {
      appId: environment.oauth.google.clientID,
      responseType: 'token', // implicit flow
      accessTokenEndpoint: '', // clear the tokenEndpoint as we know that implicit flow gets the accessToken from the authorizationRequest
      redirectUrl: 'http://localhost:8100',
      windowOptions: 'height=600',
    },
    android: {
      appId: environment.bundleId,
      responseType: 'code', // if you configured a android app in google dev console the value must be "code"
      redirectUrl: 'languageXchange:/', // package name from google dev console
    },
    ios: {
      appId: environment.bundleId,
      responseType: 'code', // if you configured a ios app in google dev console the value must be "code"
      redirectUrl: 'languageXchange:/', // Bundle ID from google dev console
    },
  };

  onOAuthBtnClick() {
    OAuth2Client.authenticate(this.oauth2Options)
      .then((response) => {
        this.accessToken = response['access_token'];

        // go to backend
        console.log('OAuth success', response);
      })
      .catch((reason) => {
        console.error('OAuth rejected', reason);
      });
  }

  onOAuthAppwrite() {
    this.api.account.createOAuth2Session(
      'google',
      environment.url.HOME_URL,
      environment.url.LOGIN_URL
    );
  }

  signInWithGoogle() {
    this.authService.signInWithGoogle();
  }

  signInWithFacebook() {
    this.authService.signInWithFacebook();
  }

  signInWithApple() {
    this.authService.signInWithApple();
  }
}
