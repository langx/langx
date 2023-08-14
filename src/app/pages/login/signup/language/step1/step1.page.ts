import { Component, OnInit } from '@angular/core';
import { languagesData } from '../../data';
import { Router } from '@angular/router';
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
    console.log('step1 completed');
    console.log(this.chosenLanguage);
    this.router.navigateByUrl('/login/signup/language/step2');
  }
}
