import { Component, OnInit } from '@angular/core';
import { languagesData } from '../../data';
import { NavigationExtras, Router } from '@angular/router';

@Component({
  selector: 'app-step1',
  templateUrl: './step1.page.html',
  styleUrls: ['./step1.page.scss'],
})
export class Step1Page implements OnInit {

  public progress: number = 0.33;
  isLoading: boolean = false;
  public languages = languagesData;
  term: string;
  
  motherLanguage: string;

  constructor(
    private router: Router
  ) { }

  ngOnInit() {
  }

  radioChecked(event){
    this.motherLanguage = event.detail.value;
  }

  step1Completed(){
    this.isLoading = true; //showLoader();
        const navData: NavigationExtras = {
      queryParams: {
        motherLanguage: this.motherLanguage
      }
    };
    this.isLoading = false; //hideLoader();
    this.router.navigate(['/','login','signup','language','step2'], navData);
    console.log('step1 completed');
  }

}