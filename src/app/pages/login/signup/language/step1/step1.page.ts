import { Component, OnInit } from '@angular/core';
import { languagesData } from '../../data';
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

  constructor() { }

  ngOnInit() {
  }

  radioChecked(event){
      console.log(event.detail.value);
  }
}
