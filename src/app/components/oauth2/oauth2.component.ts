import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { InAppBrowser, UrlEvent } from '@capgo/inappbrowser';

import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-oauth2',
  templateUrl: './oauth2.component.html',
  styleUrls: ['./oauth2.component.scss'],
})
export class Oauth2Component implements OnInit {
  HEADERS = {
    'user-agent': `Mozilla/5.0 (iPhone; CPU iPhone OS16_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5.2 Mobile/15E148 Safari/604.1`,
  };

  constructor(private router: Router) {}

  ngOnInit() {}

  signInWithGoogle() {
    InAppBrowser.openWebView({
      url: `${environment.url.AUTH_PROVIDER_URL}/google`,
      headers: this.HEADERS,
    });
    this.addBrowserListeners();
  }

  signInWithFacebook() {
    InAppBrowser.openWebView({
      url: `${environment.url.AUTH_PROVIDER_URL}/facebook`,
      headers: this.HEADERS,
    });
    this.addBrowserListeners();
  }

  signInWithApple() {
    // TODO: #313  🚀 [Feature] : Native sing-in-with-apple
    InAppBrowser.openWebView({
      url: `${environment.url.AUTH_PROVIDER_URL}/apple`,
      headers: this.HEADERS,
    });
    this.addBrowserListeners();
  }

  addBrowserListeners() {
    console.log('InAppBrowser listeners started');

    // urlChangeEvent
    InAppBrowser.addListener('urlChangeEvent', (res: UrlEvent) => {
      if (res.url.startsWith(environment.url.SUCCESS_OAUTH2)) {
        // Remove delete
        InAppBrowser.close();

        const redirectUrl = res.url.split(environment.url.HOMEPAGE_URL)[1];
        console.log('redirectUrl', redirectUrl);
        this.router.navigateByUrl(redirectUrl);
      }
      if (res.url.startsWith(environment.url.FAILURE_OAUTH2)) {
        // Remove delete
        InAppBrowser.close();

        const redirectUrl = res.url.split(environment.url.HOMEPAGE_URL)[1];
        console.log('redirectUrl', redirectUrl);
        this.router.navigateByUrl(redirectUrl);
      }
    });

    // Close event
    InAppBrowser.addListener('closeEvent', () => {
      console.log('InAppBrowser closed');
      // Remove delete
      InAppBrowser.removeAllListeners();
      console.log('all listeners removed');
    });
  }
}
