import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-step2',
  templateUrl: './step2.page.html',
  styleUrls: ['./step2.page.scss'],
})
export class Step2Page implements OnInit {

  completeData: Object = {};

  constructor(
    private route: ActivatedRoute
  ) { }

  ngOnInit() {
    const data: any = this.route.snapshot.queryParams;
    console.log('navData coming from step1', data);
  }

}