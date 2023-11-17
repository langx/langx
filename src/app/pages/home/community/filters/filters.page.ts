import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { countryData } from 'src/app/extras/data';
import { Router } from '@angular/router';
import { Observable, map } from 'rxjs';
import { Store, select } from '@ngrx/store';

import { StorageService } from 'src/app/services/storage/storage.service';
import { User } from 'src/app/models/User';
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';
import { Language } from 'src/app/models/Language';
import { FilterService } from 'src/app/services/filter/filter.service';
import { FilterDataInterface } from 'src/app/models/types/filterData.interface';

@Component({
  selector: 'app-filters',
  templateUrl: './filters.page.html',
  styleUrls: ['./filters.page.scss'],
})
export class FiltersPage implements OnInit {
  searchTerm: string;
  countryData = countryData;

  // TODO: Useless
  isLoading: boolean = false;

  currentUser$: Observable<User | null>;

  ionRangeDefault = { lower: 20, upper: 75 };

  // Filters data
  filterData: FilterDataInterface = {
    languages: [],
    gender: null,
    country: null,
    minAge: null,
    maxAge: null,
  };

  constructor(
    private store: Store,
    private navCtrl: NavController,
    private router: Router,
    private filterService: FilterService,
    private storageService: StorageService
  ) {}

  async ngOnInit() {
    this.initValues();
    await this.checkStorage();
  }

  initValues() {
    this.currentUser$ = this.store.pipe(select(currentUserSelector));
  }

  async checkStorage() {
    // Check localStorage
    const languagesString = await this.storageService.getValue('languages');
    const gender = (await this.storageService.getValue('gender')) || null;
    const country = (await this.storageService.getValue('country')) || null;
    const minAgeString = await this.storageService.getValue('minAge');
    const maxAgeString = await this.storageService.getValue('maxAge');

    let minAge = Number(minAgeString) || null;
    let maxAge = Number(maxAgeString) || null;

    let languages: Array<any> = [];
    if (languagesString) {
      languages = languagesString.toLocaleString().split(',');
    }

    this.filterData.languages = languages;
    this.filterData.gender = gender;
    this.filterData.country = country;
    this.filterData.minAge = minAge;
    this.filterData.maxAge = maxAge;

    console.log('checkLocalStorage', this.filterData);
  }

  onSubmit() {
    this.setLocalStorage(this.filterData);
    this.filterService.setEvent(this.filterData);

    this.navCtrl.setDirection('back');
    this.router.navigateByUrl('/home/community');
  }

  // TODO: #246 Save filterData with JSON.stringify();
  setLocalStorage(filterData: FilterDataInterface) {
    if (!filterData.languages) filterData.languages = [];
    if (filterData.languages.length > 0) {
      this.storageService.setValue(
        'languages',
        filterData.languages.toString()
      );
    } else {
      this.storageService.removeValue('languages');
    }
    if (filterData.gender) {
      this.storageService.setValue('gender', filterData.gender);
    }
    if (filterData.country) {
      this.storageService.setValue('country', filterData.country);
    }
    if (filterData.minAge && filterData.maxAge) {
      this.storageService.setValue('minAge', filterData.minAge.toString());
      this.storageService.setValue('maxAge', filterData.maxAge.toString());
    }
  }

  removeLocalStorage() {
    this.storageService.removeValue('languages');
    this.storageService.removeValue('gender');
    this.storageService.removeValue('country');
    this.storageService.removeValue('minAge');
    this.storageService.removeValue('maxAge');
  }

  //
  // LANGUAGE Methods
  //

  getStudyLanguages(): Observable<Language[]> {
    return this.currentUser$.pipe(
      map((user) => user.languages.filter((lang) => !lang.motherLanguage))
    );
  }

  languageChecked(event, langName) {
    if (event.detail.checked) {
      if (!this.filterData.languages) this.filterData.languages = [];
      this.filterData.languages.push(langName);
    } else {
      this.filterData.languages = this.filterData.languages.filter(
        (item) => item !== langName
      );
    }
    console.log(this.filterData);
  }

  isCheckedLanguage(langName) {
    if (!this.filterData.languages) return false;
    else if (this.filterData.languages.length == 0) return false;
    else if (
      this.filterData.languages.length > 0 &&
      this.filterData.languages.includes(langName)
    )
      return true;
    else return false;
  }

  //
  // COUNTRY Methods
  //

  countryChange(event) {
    if (event.detail.value) {
      this.filterData.country = event.detail.value;
    }
    console.log(this.filterData);
  }

  showCountry() {
    return countryData.find((item) => item.value === this.filterData.country)
      ?.text;
  }

  //
  // GENDER Methods
  //

  genderChange(event) {
    if (event.detail.value) {
      this.filterData.gender = event.detail.value;
    }
    console.log(this.filterData);
  }

  showGender() {
    if (this.filterData.gender == 'male') {
      return 'Male';
    } else if (this.filterData.gender == 'female') {
      return 'Female';
    } else if (this.filterData.gender == 'other') {
      return 'Other';
    } else return false;
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
      return (
        'between ' + this.filterData.minAge + ' and ' + this.filterData.maxAge
      );
    } else return false;
  }

  //
  // RESET All Filters
  //

  resetFilter() {
    this.filterData = {
      languages: [],
      gender: null,
      country: null,
      minAge: null,
      maxAge: null,
    };
    console.log(this.filterData);
    this.ionRangeDefault = { lower: 20, upper: 75 };
    this.removeLocalStorage();
  }
}
