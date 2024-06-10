import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { Router } from '@angular/router';
import { Observable, Subscription, map } from 'rxjs';
import { Store, select } from '@ngrx/store';

import { StorageService } from 'src/app/services/storage/storage.service';
import { User } from 'src/app/models/User';
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';
import { Language } from 'src/app/models/Language';
import { FilterDataInterface } from 'src/app/models/types/filterData.interface';
import { Countries } from 'src/app/models/locale/Countries';
import { Country } from 'src/app/models/locale/Country';
import { countriesSelector } from 'src/app/store/selectors/locale.selector';

@Component({
  selector: 'app-filters',
  templateUrl: './filters.page.html',
  styleUrls: ['./filters.page.scss'],
})
export class FiltersPage implements OnInit, OnDestroy {
  searchTerm: string;

  isLoading: boolean = false;

  private subscriptions = new Subscription();
  currentUser$: Observable<User | null>;
  countries$: Observable<Countries>;
  countyData: Country[];

  ionRangeDefault = { lower: 20, upper: 75 };

  // Filters data
  filterData: FilterDataInterface = {
    motherLanguages: [],
    studyLanguages: [],
    gender: null,
    country: null,
    minAge: null,
    maxAge: null,
  };

  constructor(
    private store: Store,
    private navCtrl: NavController,
    private router: Router,
    private storageService: StorageService
  ) {}

  async ngOnInit() {
    this.initValues();
    await this.checkLocalStorage();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  initValues() {
    // Countries values
    this.countries$ = this.store.pipe(select(countriesSelector));
    this.subscriptions.add(
      this.countries$.subscribe((countries: Countries) => {
        this.countyData = countries?.countries;
      })
    );

    this.currentUser$ = this.store.pipe(select(currentUserSelector));
  }

  async checkLocalStorage() {
    // Check localStorage
    const filterDataString = await this.storageService.getValue('filterData');

    if (filterDataString) {
      // Parse the JSON string back into an object
      const filterData = JSON.parse(filterDataString);

      // Use object destructuring to extract properties
      const {
        motherLanguages = [],
        studyLanguages = [],
        gender = null,
        country = null,
        minAge = null,
        maxAge = null,
      } = filterData;

      this.filterData = {
        motherLanguages,
        studyLanguages,
        gender,
        country,
        minAge: Number(minAge),
        maxAge: Number(maxAge),
      };
    }
    console.log(`filters.page.ts:`, this.filterData);
  }
  onSubmit() {
    this.setLocalStorage(this.filterData);

    this.navCtrl.setDirection('back');
    this.router.navigateByUrl('/home/community');
  }

  setLocalStorage(filterData: FilterDataInterface) {
    if (!filterData.motherLanguages) filterData.motherLanguages = [];
    if (!filterData.studyLanguages) filterData.studyLanguages = [];

    // Convert filterData to a JSON string
    const filterDataJson = JSON.stringify(filterData);

    // Save the JSON string to local storage
    this.storageService.setValue('filterData', filterDataJson);
  }

  removeLocalStorage() {
    this.storageService.removeValue('filterData');
  }

  //
  // LANGUAGE Methods
  //

  getLanguages(): Observable<Language[]> {
    return this.currentUser$.pipe(map((user) => user.languages));
  }

  motherLanguageChecked(event, langName) {
    this.filterData.motherLanguages = this.filterData.motherLanguages || [];
    if (event.detail.checked) {
      this.filterData.motherLanguages.push(langName);
    } else {
      this.filterData.motherLanguages = this.filterData.motherLanguages.filter(
        (item) => item !== langName
      );
    }
  }

  isCheckedMotherLanguage(langName) {
    return (
      this.filterData.motherLanguages &&
      this.filterData.motherLanguages.includes(langName)
    );
  }

  studyLanguageChecked(event, langName) {
    this.filterData.studyLanguages = this.filterData.studyLanguages || [];
    if (event.detail.checked) {
      this.filterData.studyLanguages.push(langName);
    } else {
      this.filterData.studyLanguages = this.filterData.studyLanguages.filter(
        (item) => item !== langName
      );
    }
    console.log(this.filterData);
  }
  isCheckedStudyLanguage(langName) {
    return (
      this.filterData.studyLanguages &&
      this.filterData.studyLanguages.includes(langName)
    );
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
    return this.countyData.find((item) => item.code === this.filterData.country)
      ?.name;
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
      return 'Prefer Not to Say';
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
      motherLanguages: [],
      studyLanguages: [],
      gender: null,
      country: null,
      minAge: null,
      maxAge: null,
    };
    // TODO: Remove following console.log
    console.log(this.filterData);
    this.ionRangeDefault = { lower: 20, upper: 75 };
    this.removeLocalStorage();
  }
}
