import { Component, OnInit } from '@angular/core';
import { OAuth2Client } from '@byteowls/capacitor-oauth2';

import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-oauth2',
  templateUrl: './oauth2.component.html',
  styleUrls: ['./oauth2.component.scss'],
})
export class Oauth2Component implements OnInit {
  accessToken: string;
  refreshToken: string;

  constructor() {}

  ngOnInit() {}

  oauth2Options = {
    authorizationBaseUrl: 'https://accounts.google.com/o/oauth2/auth',
    accessTokenEndpoint: 'https://www.googleapis.com/oauth2/v4/token',
    scope: 'email profile',
    resourceUrl: 'https://www.googleapis.com/userinfo/v2/me',
    logsEnabled: true,
    web: {
      appId: environment.oauth.google.clientID,
      responseType: 'token', // implicit flow
      accessTokenEndpoint: '', // clear the tokenEndpoint as we know that implicit flow gets the accessToken from the authorizationRequest
      redirectUrl: 'http://localhost:8100',
      windowOptions: 'height=600,left=0,top=0',
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
        this.accessToken = response['access_token']; // storage recommended for android logout
        this.refreshToken = response['refresh_token'];

        // only if you include a resourceUrl protected user values are included in the response!
        let oauthUserId = response['id'];
        let name = response['name'];

        // go to backend
      })
      .catch((reason) => {
        console.error('OAuth rejected', reason);
      });
  }

  onOAuthRefreshBtnClick() {}

  onLogoutClick() {}
}
