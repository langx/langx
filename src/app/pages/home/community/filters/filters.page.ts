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
  filterData: FilterData = {} as FilterData;

  constructor(
    private authService: AuthService,
    private navCtrl: NavController,
    private router: Router,
    private filterService: FilterService,
    private storageService: StorageService
  ) { }

  async ngOnInit() {
    await this.getUserData();
    await this.checkStorage();
  }

  async getUserData() {
    this.authService.getUserData().then((currentUserData) => {
      this.currentUserData = currentUserData;
    }).catch((error) => {
      console.log('error: ', error);
    });
  }

  async checkStorage() {

    // TODO: check localStorage
    /*
    const languagesString = await this.storageService.get("languages") ;
    const gender = await this.storageService.get("gender") || null;
    const country = await this.storageService.get("country") || null;
    const minAgeString = await this.storageService.get("minAge");
    const maxAgeString = await this.storageService.get("maxAge");
    
    let minAge = Number(minAgeString) || null;
    let maxAge = Number(maxAgeString) || null;

    let languages : Array<any> = [];
    if(languagesString) {
      languages = languagesString.toLocaleString().split(",");
    }

    let filterData: FilterData = {
      languages: languages,
      gender: gender,
      country: country,
      minAge: minAge,
      maxAge: maxAge
    }

    console.log('checkLocalStorage', filterData);
    this.filterService.setEvent(filterData);
    */
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
    //let filterData: FilterData = {
      //languages: this.languages,
      //gender: this.gender,
      //country: this.country,
      //minAge: this.minAge,
      //maxAge: this.maxAge
    //}
    this.doSomething(this.filterData);

    this.navCtrl.setDirection('back');
    this.router.navigateByUrl('/home/community');
  }

  doSomething(filterData: FilterData): void {
    this.setLocalStorage(filterData);
    this.filterService.setEvent(filterData);
  }

  setLocalStorage(filterData: FilterData) {
    if (!filterData.languages) filterData.languages = [];
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
      if(!this.filterData.languages) this.filterData.languages = [];
      this.filterData.languages.push(langCode);
    } else {
      this.filterData.languages = this.filterData.languages.filter(item => item !== langCode);
    }
    console.log(this.filterData);
  }

  isCheckedLanguage(langCode) {
    if(!this.filterData.languages) return false;
    else if (this.filterData.languages.length == 0) return false;
    else if (this.filterData.languages.length > 0 && this.filterData.languages.includes(langCode)) return true;
    else return false;
  }

  //
  // COUNTRY Methods
  //

  countryChange(event) {
    if(event.detail.value) {
      this.filterData.country = event.detail.value;
    }
    console.log(this.filterData);
  }

  showCountry() {
    return countryData.find(item => item.value === this.filterData.country)?.text;
  }

  //
  // GENDER Methods
  //

  genderChange(event) {
    if(event.detail.value) {
      this.filterData.gender = event.detail.value;
    }
    console.log(this.filterData);
  }

  showGender() {
    if (this.filterData.gender=='male') { return "Male" }
    else if (this.filterData.gender=='female') { return "Female" }
    else if (this.filterData.gender=='other') { return "Other" }
    else return false;
  }

  //
  // AGE Methods
  //

  ageChange(event) {
    if (event.detail.value) {
      this.filterData.minAge = event.detail.value.lower;
      this.filterData.maxAge = event.detail.value.upper;
    }
    console.log(this.filterData);
  }

  showAge() {
    if (this.filterData.minAge && this.filterData.maxAge) {
      return 'between ' + this.filterData.minAge + ' and ' + this.filterData.maxAge;
    } else return false;
  }

  //
  // RESET All Filters
  //

  resetFilter(){
    this.filterData = {} as FilterData;
    console.log(this.filterData)
    this.ionRangeDefault = { lower: 20, upper: 75 };
    this.removeLocalStorage();
  }

}