import { Component, OnInit } from '@angular/core';
import { Browser } from '@capacitor/browser';

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

  signInWithGoogle() {
    Browser.open({
      url: `${environment.url.AUTH_PROVIDER_URL}/google`,
    });
    // this.authService.signInWithGoogle();
  }

  signInWithFacebook() {
    this.authService.signInWithFacebook();
  }

  signInWithApple() {
    // TODO: #313  🚀 [Feature] : Native sing-in-with-apple
    this.authService.signInWithApple();
  }
}
