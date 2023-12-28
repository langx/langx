import { Component, OnInit } from '@angular/core';
// TODO: Test Cookies
import { CapacitorCookies } from '@capacitor/core';
import { CookieService } from 'ngx-cookie-service';

@Component({
  selector: 'app-oauth2-callback',
  templateUrl: './oauth2-callback.component.html',
  styleUrls: ['./oauth2-callback.component.scss'],
})
export class Oauth2CallbackComponent implements OnInit {
  constructor(private cookieService: CookieService) {}

  async ngOnInit() {
    await this.setCapacitorCookie();
    this.getCookies();
    let a = this.cookieService.getAll()
    console.log('cookie-service', a);
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
