import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-new',
  templateUrl: './new.page.html',
  styleUrls: ['./new.page.scss'],
})
export class NewPage implements OnInit {
  id: string;
  secret: string;
  expire: Date;
  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.id = this.route.snapshot.queryParamMap.get('userId');
    this.secret = this.route.snapshot.queryParamMap.get('secret');
    this.expire = new Date(this.route.snapshot.queryParamMap.get('expire'));
    console.log(this.id, this.secret, this.expire);
  }
}
