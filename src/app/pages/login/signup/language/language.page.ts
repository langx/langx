import { Component, OnInit } from '@angular/core';
import { languagesData } from '../data';
import { FormControl, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-language',
  templateUrl: './language.page.html',
  styleUrls: ['./language.page.scss'],
})
export class LanguagePage implements OnInit {
  
  public progress: number = 0.33;
  isLoading: boolean = false;
  public languages = languagesData;
  term: string;

  constructor() { }

  ngOnInit() {
  }

  radioChecked(event){
      console.log(event.detail.value);
  }

}