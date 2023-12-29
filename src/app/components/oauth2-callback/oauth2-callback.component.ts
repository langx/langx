import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { StorageService } from 'src/app/services/storage/storage.service';

@Component({
  selector: 'app-oauth2-callback',
  templateUrl: './oauth2-callback.component.html',
  styleUrls: ['./oauth2-callback.component.scss'],
})
export class Oauth2CallbackComponent implements OnInit {
  // TODO: Delete following lines
  // params: Params;
  // token: string = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private storageService: StorageService
  ) {}

  async ngOnInit() {
    await this.initValues();
  }

  async initValues() {
    // Set Params
    const params = this.route.snapshot.queryParamMap;
    console.log('params: ', params);

    const cookieFallback = {};
    const key = params.get('key');
    const secret = params.get('secret');

    if (key) {
      cookieFallback[key] = secret;
    }

    const cookieValue = JSON.stringify(cookieFallback);
    console.log('cookieValue: ', cookieValue);

    localStorage.setItem('cookieFallback', cookieValue);
    this.router.navigateByUrl('/home');

    // this.storageService.setValue(
    //   'cookieFallback',
    //   JSON.stringify(cookieFallback)
    // );
    // await CapacitorCookies.setCookie({
    //   url: params.get('domain') || null,
    //   key: params.get('key') || null,
    //   value: params.get('secret') || null,
    // });

    // await CapacitorCookies.setCookie({
    //   url: '192.168.0.104',
    //   key: '1db.languagexchange.net',
    //   value: '1db.languagexchange.net',
    // });

    // console.log('cookies:', document.cookie);

    // await this.api.account.getSession('current').then((response) => {
    //   console.log('session: ', response);
    // });

    // TODO: Delete following lines
    // if (this.params['jwt']) {
    //   this.token = this.params['jwt'];
    //   console.log('jwt: ', this.token);
    //   console.log('redirect to mobile app');

    //   this.navigateWithToken();
    // } else {
    //   // Check session
    //   this.checkSession()
    //     .then(async (response) => {
    //       console.log('session: ', response);
    //       console.log('creating new jwt..');
    //       this.token = (await this.createJWT()).jwt;
    //       console.log('jwt: ', this.token);
    //       console.log('redirect to web app');

    //       this.navigateWithToken();
    //     })
    //     .catch((error) => {
    //       console.log('error: ', error);
    //       console.log('There is no user session. Redirect to login page.');
    //     });
    // }
  }

  // checkSession() {
  //   return this.api.account.getSession('current');
  // }

  // createJWT() {
  //   return this.authService.createJWT();
  // }

  // navigateWithToken() {
  //   // TODO: If there is no app installed in the device, redirect to web app
  //   // window.location.href = `tech.newchapter.languagexchange:/login/oauth2/${this.token}`;
  //   // this.navigateToHome();
  // }

  // navigateToHome() {
  //   // this.router.navigateByUrl('/home');
  //   // TODO: Remove this line
  //   this.router.navigateByUrl(`/login/oauth2/${this.token}`);
  // }
}
