import { Component, OnInit } from '@angular/core';
import { Capacitor } from '@capacitor/core';

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
    this.authService.signInWithGoogle();
  }

  signInWithFacebook() {
    this.authService.signInWithFacebook();
  }

  signInWithApple() {
    // TODO: It may be better usage
    if (Capacitor.getPlatform() === 'web') {
      this.authService.signInWithApple();
    } else {
      this.signInWithAppleNative();
    }
  }

  signInWithAppleNative() {
    console.log('signInWithAppleNative');
  }
}
