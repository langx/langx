import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { languagesData } from 'src/app/extras/data';

@Component({
  selector: 'app-new',
  templateUrl: './new.page.html',
  styleUrls: ['./new.page.scss'],
})
export class NewPage implements OnInit {

  searchTerm: string;
  languageData: any;

  isLoading: boolean = false;

  constructor(
    private router: Router
  ) { }

  ngOnInit() {
    const languagesArray: any = this.router.getCurrentNavigation().extras.state;

    // remove languages already selected
    this.languageData = languagesData.filter((language) => !languagesArray.includes(language.code));
  }

  onSubmit() {
    console.log('submit');
  }

}