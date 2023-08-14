import { Component, OnInit } from '@angular/core';
import { languagesData } from '../../data';
import { ActivatedRoute } from '@angular/router';
import { NavigationExtras, Router } from '@angular/router';

@Component({
  selector: 'app-step2',
  templateUrl: './step2.page.html',
  styleUrls: ['./step2.page.scss'],
})
export class Step2Page implements OnInit {

  public progress: number = 0.66;
  isLoading: boolean = false;
  public languages = languagesData;
  term: string;
  
  motherLanguage: string;
  studyLanguage: Array<string> = [];

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit() {
    const data: any = this.route.snapshot.queryParams;
    console.log('navData coming from step1', data);
    this.motherLanguage = data.motherLanguage;
  }

  checkboxChecked(event){
    if(this.studyLanguage.includes(event.detail.value)){
      this.studyLanguage = this.studyLanguage.filter(item => item !== event.detail.value);
      console.log(this.studyLanguage);
      return;
    } else {
      this.studyLanguage.push(event.detail.value);
      console.log(this.studyLanguage);
      return;
    }
  }

  step2Completed(){
    this.isLoading = true; //showLoader();
    const navData: NavigationExtras = {
      queryParams: {
        motherLanguage: this.motherLanguage,
        studyLanguage: this.studyLanguage
      }
    };
    this.isLoading = false; //hideLoader();
    this.router.navigate(['/','login','signup','language','step3'], navData);
    console.log('step2 completed');
  }

}