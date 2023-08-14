import { Component, OnInit } from '@angular/core';
import { languagesData } from '../data';
import { FormControl, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-language',
  templateUrl: './language.page.html',
  styleUrls: ['./language.page.scss'],
})
export class LanguagePage implements OnInit {
  
  public progress: number = 0.93;
  public languages = languagesData;
  public results = [...this.languages];
  term: string;

  constructor() { }

  ngOnInit() {
  }

  search(event){
    console.log(event.detail.value);
  }

  languageChange(event){
    console.log(event.detail.value);
  }

  handleInput(event) {
    const query = event.target.value.toLowerCase();
    this.results = this.languages.filter((d) => {
      let tmp = d.name.toLowerCase();
      let tmp2 = tmp.indexOf(query) 
      return tmp2 > -1;
    }); 
  }
}