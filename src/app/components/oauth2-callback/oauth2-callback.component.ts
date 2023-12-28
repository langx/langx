import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

// TODO: Test Cookies
import { CapacitorCookies } from '@capacitor/core';
import { CookieService } from 'ngx-cookie-service';

import { AuthService } from 'src/app/services/auth/auth.service';

@Component({
  selector: 'app-oauth2-callback',
  templateUrl: './oauth2-callback.component.html',
  styleUrls: ['./oauth2-callback.component.scss'],
})
export class Oauth2CallbackComponent implements OnInit {
  constructor(
    private cookieService: CookieService,
    private route: ActivatedRoute,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    await this.setCapacitorCookie();
    this.getCookies();
    let a = this.cookieService.getAll();
    console.log('cookie-service', a);

    const params = this.route.snapshot.queryParams;

    this.authService.getCookies(params);
  }

  async setCapacitorCookie() {
    await CapacitorCookies.setCookie({
      url: 'app.languagexchange.net',
      key: 'language1',
      value: 'en2',
    });
  }

  getCookies() {
    console.log(document.cookie);
  }
}
