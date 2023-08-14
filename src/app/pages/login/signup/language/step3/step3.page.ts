import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-step3',
  templateUrl: './step3.page.html',
  styleUrls: ['./step3.page.scss'],
})
export class Step3Page implements OnInit {

  motherLanguage: string;
  studyLanguage: Array<string> = [];

  constructor(
    private route: ActivatedRoute,
  ) { }

  ngOnInit() {
    const data: any = this.route.snapshot.queryParams;
    console.log('navData coming from step2', data);
    this.motherLanguage = data.motherLanguage;
    this.studyLanguage = data.studyLanguage;
    console.log('motherLanguage', this.motherLanguage, 'studyLanguage', this.studyLanguage);
  }

}
