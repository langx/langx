import { Component, OnInit } from '@angular/core';

import { OAuth2Service } from 'src/app/services/auth/oauth2.service';

@Component({
  selector: 'app-oauth2',
  templateUrl: './oauth2.component.html',
  styleUrls: ['./oauth2.component.scss'],
})
export class Oauth2Component implements OnInit {
  HEADERS = {
    'user-agent': `Mozilla/5.0 (iPhone; CPU iPhone OS16_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5.2 Mobile/15E148 Safari/604.1`,
  };

  constructor(private OAuth2Service: OAuth2Service) {}

  ngOnInit() {}

  signInWithDiscord() {
    this.OAuth2Service.signInWithDiscord();
  }

  signInWithGoogle() {
    this.OAuth2Service.signInWithGoogle();
  }

  signInWithFacebook() {
    this.OAuth2Service.signInWithFacebook();
  }

  signInWithApple() {
    this.OAuth2Service.signInWithApple();
  }
}
