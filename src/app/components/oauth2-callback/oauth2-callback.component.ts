import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { AuthService } from 'src/app/services/auth/auth.service';
import { ApiService } from 'src/app/services/api/api.service';

@Component({
  selector: 'app-oauth2-callback',
  templateUrl: './oauth2-callback.component.html',
  styleUrls: ['./oauth2-callback.component.scss'],
})
export class Oauth2CallbackComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private api: ApiService
  ) {}

  async ngOnInit() {
    this.api.account.createJWT().then((res) => {
      console.log('createJWT', res);
    });
  }
}
