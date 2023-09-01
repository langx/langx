import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { AuthService } from 'src/app/services/auth/auth.service';
import { countryData } from 'src/app/extras/data';
import { Router } from '@angular/router';
import { FilterService, FilterData } from 'src/app/services/filter/filter.service';
import { StorageService } from 'src/app/services/storage/storage.service';

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

  ionRangeDefault = { lower: 20, upper: 75 };

  // filters data
  languages = []
  gender: string = null;
  country: string = null;
  minAge: Number = null;
  maxAge: Number = null;

  constructor(
    private authService: AuthService,
    private navCtrl: NavController,
    private router: Router,
    private filterService: FilterService,
    private storageService: StorageService
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
    // here set filterData for filterService
    let filterData: FilterData = {
      languages: this.languages,
      gender: this.gender,
      country: this.country,
      minAge: this.minAge,
      maxAge: this.maxAge
    }
    this.doSomething(filterData);

    this.navCtrl.setDirection('back');
    this.router.navigateByUrl('/home/community');
  }

  doSomething(filterData: FilterData): void {
    this.setLocalStorage(filterData);
    this.filterService.setEvent(filterData);
    // this.filterService.saveFilter(filterData);
  }

  setLocalStorage(filterData: FilterData) {
    if (filterData.languages.length > 0) {
      this.storageService.set('languages', filterData.languages);
    }
    if (filterData.gender) {
      this.storageService.set('gender', filterData.gender);
    }
    if (filterData.country) {
      this.storageService.set('country', filterData.country);
    }
    if (filterData.minAge && filterData.maxAge) {
      this.storageService.set('minAge', filterData.minAge);
      this.storageService.set('maxAge', filterData.maxAge);
    }
  }

  removeLocalStorage() {
    this.storageService.remove('languages');
    this.storageService.remove('gender');
    this.storageService.remove('country');
    this.storageService.remove('minAge');
    this.storageService.remove('maxAge');
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

  isCheckedLanguage(langCode) {
    if(this.languages.includes(langCode)) return true;
    else return false;
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

  //
  // RESET All Filters
  //

  resetFilter(){
    this.languages = [];
    this.gender = null;
    this.country = null;
    this.minAge = null;
    this.maxAge = null;
    this.ionRangeDefault = { lower: 20, upper: 75 };
    this.removeLocalStorage();
  }

}