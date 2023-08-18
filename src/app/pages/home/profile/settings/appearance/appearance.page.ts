import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-appearance',
  templateUrl: './appearance.page.html',
  styleUrls: ['./appearance.page.scss'],
})
export class AppearancePage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

  modeChange = (event) => {  
    let val = event.detail.value;
    console.log(val);
    //document.body.classList.toggle('dark');
  }

}