import { Component, OnInit } from '@angular/core';
import { Capacitor } from '@capacitor/core';

import { ApiService } from 'src/app/services/api/api.service';
import { AuthService } from 'src/app/services/auth/auth.service';

@Component({
  selector: 'app-oauth2',
  templateUrl: './oauth2.component.html',
  styleUrls: ['./oauth2.component.scss'],
})
export class Oauth2Component implements OnInit {
  accessToken: string;
  platform: string;

  constructor(private api: ApiService, private authService: AuthService) {}

  ngOnInit() {
    this.platform = Capacitor.getPlatform();
  }

  signInWithGoogle() {
    this.authService.signInWithGoogle(this.platform);
  }

  signInWithFacebook() {
    this.authService.signInWithFacebook(this.platform);
  }

  signInWithApple() {
    this.authService.signInWithApple(this.platform);
  }
}
