import { Component, OnInit } from '@angular/core';
import { ModalController, NavController } from '@ionic/angular';
import { AuthService } from 'src/app/services/auth/auth.service';
import { countryData } from 'src/app/extras/data';
import { Router } from '@angular/router';
import { FilterService, FilterData } from 'src/app/services/filter/filter.service';

@Component({
  selector: 'app-filters',
  templateUrl: './filters.page.html',
  styleUrls: ['./filters.page.scss'],
})

export class FiltersPage implements OnInit {

  countryData = countryData;
  searchTerm: string;

  isLoading: boolean = false;
  currentUserData: any;

  // filters data
  languages = []
  gender: string;
  country: string;
  minAge: Number;
  maxAge: Number;

  constructor(
    private authService: AuthService,
    private modalCtrl: ModalController,
    private navCtrl: NavController,
    private router: Router,
    private filterService: FilterService,
  ) { }

  ngOnInit() {
    this.getUserData();
  }

  getUserData() {
    this.authService.getUserData().then((currentUserData) => {
      this.currentUserData = currentUserData;
    }).catch((error) => {
      console.log('error: ', error);
    });
  }

  async fetchFilteredUsers() {
    const languages = ['en', 'es', 'zh']
    const gender = 'male';
    const country = 'AF';
    const minAge = 13;
    const maxAge = 100;
  }

  onSubmit() { 
    /*
    // here set filterData for filterService
    let filterData: isFilter = {
      isFilterLanguage: this.isFilterLanguage,
      isFilterGender: this.isFilterGender,
      isFilterCountry: this.isFilterCountry,
      isFilterAge: this.isFilterAge,
      filterLanguage: this.filterLanguage,
      filterGender: this.filterGender,
      filterCountry: this.filterCountry,
      filterAge: this.filterAge,
    }
    this.doSomething(filterData);
    */

    this.navCtrl.setDirection('back');
    this.router.navigateByUrl('/home/community');
  }

  doSomething(filterData: FilterData): void {
      this.filterService.setEvent(filterData);
      //this.filterService.saveFilter(filterData);
  }

  //
  // LANGUAGE Methods
  //

  languageChecked(event, langCode) {
    if(event.detail.checked) {
      this.languages.push(langCode);
    } else {
      this.languages = this.languages.filter(item => item !== langCode);
    }
    console.log(this.languages)
  }

  //
  // COUNTRY Methods
  //

  countryChange(event) {
    if(event.detail.value) {
      this.country = event.detail.value;
    }
  }

  showCountry() {
    return countryData.find(item => item.value === this.country)?.text;
  }

  //
  // GENDER Methods
  //

  genderChange(event) {
    if(event.detail.value) {
      this.gender = event.detail.value;
    }
  }

  showGender() {
    if (this.gender=='male') { return "Male" }
    else if (this.gender=='female') { return "Female" }
    else if (this.gender=='other') { return "Other" }
    else return false;
  }


  //
  // AGE Methods
  //

  ageChange(event) {
    if (event.detail.value) {
      this.minAge = event.detail.value.lower;
      this.maxAge = event.detail.value.upper;
    }
  }

  showAge() {
    if (this.minAge && this.maxAge) {
      return 'between ' + this.minAge + ' and ' + this.maxAge;
    } else return false;
  }

  /*
  //
  // RESET All Filters
  //

  resetFilter(){
    this.filterLanguage = [];
    this.filterGender = '';
    this.filterCountry = '';
    this.filterAge = {};
    this.isFilterLanguage = false;
    this.isFilterGender = false;
    this.isFilterCountry = false;
    this.isFilterAge = false;
  }

  */
}