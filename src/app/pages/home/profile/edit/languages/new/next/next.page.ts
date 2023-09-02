import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-next',
  templateUrl: './next.page.html',
  styleUrls: ['./next.page.scss'],
})
export class NextPage implements OnInit {

  isLoading: boolean = false;
  selectedLanguage: any;

  constructor(
    private router: Router,
  ) { }

  ngOnInit() {
    const selectedLanguage: any = this.router.getCurrentNavigation().extras.state;
    this.selectedLanguage = selectedLanguage;
    console.log('selectedLanguage:' + selectedLanguage.code);
  }

  radioChecked(event, selectedLanguage) {
    this.selectedLanguage.level = event.detail.value;
    console.log('radioChecked:' + selectedLanguage);

  }
  
  onSubmit() {

  }

}