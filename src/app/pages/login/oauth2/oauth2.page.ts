import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { Store } from '@ngrx/store';
import { LoginWithJwtRequestInterface } from 'src/app/models/types/requests/loginWithJwtRequest.interface';

import { loginWithJWTAction } from 'src/app/store/actions/auth.action';

@Component({
  selector: 'app-oauth2',
  templateUrl: './oauth2.page.html',
  styleUrls: ['./oauth2.page.scss'],
})
export class Oauth2Page implements OnInit {
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private store: Store
  ) {}

  ngOnInit() {
    this.initValues();
  }

  initValues() {
    const token = this.route.snapshot.paramMap.get('token') || null;
    if (
      Capacitor.getPlatform() === 'android' ||
      Capacitor.getPlatform() === 'ios'
    ) {
      if (token) {
        console.log('Dispatch to loginWithJWTAction');
        let request: LoginWithJwtRequestInterface = { jwt: token };
        this.store.dispatch(loginWithJWTAction({ request }));
        return;
      }
    }

    this.router.navigateByUrl('/home');
    return;
  }
}
