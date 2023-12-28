import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';

import { AuthService } from 'src/app/services/auth/auth.service';

@Component({
  selector: 'app-oauth2-callback',
  templateUrl: './oauth2-callback.component.html',
  styleUrls: ['./oauth2-callback.component.scss'],
})
export class Oauth2CallbackComponent implements OnInit {
  params: Params;

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    this.initValues();
  }

  initValues() {
    // Set Params
    this.params = this.route.snapshot.queryParams;
  }

  createJWT() {
    return this.authService.createJWT();
  }
}
