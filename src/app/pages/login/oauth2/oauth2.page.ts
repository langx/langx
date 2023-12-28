import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-oauth2',
  templateUrl: './oauth2.page.html',
  styleUrls: ['./oauth2.page.scss'],
})
export class Oauth2Page implements OnInit {
  token: string = null;

  constructor(private router: Router, private route: ActivatedRoute) {}

  ngOnInit() {
    this.initValues();
  }

  initValues() {
    this.token = this.route.snapshot.paramMap.get('token') || null;
    if (
      Capacitor.getPlatform() === 'android' ||
      Capacitor.getPlatform() === 'ios'
    ) {
      if (this.token) {
        console.log('Dispatch to loginWithJWTAction');
        return;
      } else {
        this.router.navigateByUrl('/home');
        return;
      }
    }

    this.router.navigateByUrl('/home');
    return;
  }
}
