import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-oauth2-callback',
  templateUrl: './oauth2-callback.component.html',
  styleUrls: ['./oauth2-callback.component.scss'],
})
export class Oauth2CallbackComponent implements OnInit {
  constructor(private route: ActivatedRoute, private router: Router) {}

  async ngOnInit() {
    await this.initValues();
  }

  async initValues() {
    // Set Params
    const params = this.route.snapshot.queryParamMap;

    const cookieFallback = {};
    const key = params.get('key');
    const secret = params.get('secret');

    if (key) {
      cookieFallback[key] = secret;
    }

    const cookieValue = JSON.stringify(cookieFallback);
    console.log('cookieValue: ', cookieValue);

    // TODO: Dispatch to somewhere because
    localStorage.setItem('cookieFallback', cookieValue);

    // TODO: There is a bug here, it loads the home page before the cookie is set
    setTimeout(() => {
      this.router.navigateByUrl('/');
    }, 200);
  }
}
