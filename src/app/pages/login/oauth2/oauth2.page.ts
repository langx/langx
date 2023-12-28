import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-oauth2',
  templateUrl: './oauth2.page.html',
  styleUrls: ['./oauth2.page.scss'],
})
export class Oauth2Page implements OnInit {
  token: string = null;

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.initValues();
  }

  initValues() {
    this.token = this.route.snapshot.paramMap.get('token') || null;
  }
}
