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
  
  chosenLanguage: string = 'en';

  constructor(
    private router: Router
  ) { }

  ngOnInit() {
  }

  radioChecked(event){
      this.chosenLanguage = event.detail.value;
  }

  step1Completed(){
    // showLoader();
    this.isLoading = true;
    console.log('step1 completed');
    const navData: NavigationExtras = {
      queryParams: {
        motherLanguage: this.chosenLanguage 
      }
    };
    // hideLoader();
    this.isLoading = false;
    this.router.navigate(['/','login','signup','language','step2'], navData);
  }
}