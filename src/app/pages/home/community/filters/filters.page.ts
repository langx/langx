import { Component, OnInit } from '@angular/core';
import { ModalController, NavController } from '@ionic/angular';
import { LanguageLevelModalComponent } from 'src/app/components/language-level-modal/language-level-modal.component';
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

  // TODO: This following component should be deleted !!
  /*
  async openLangModal(lang) {
    const modal = await this.modalCtrl.create({
      // TODO: it should be a style with --auto-height
      initialBreakpoint: 0.5,
      breakpoints: [0, 0.5, 1],
      cssClass: 'modalClass',
      component: LanguageLevelModalComponent,
      componentProps: { langName: lang?.name }
    });
    modal.present();

    const { data, role } = await modal.onWillDismiss();

    if (role === 'confirm') {
      this.languages.push(lang?.code);
    }
  }
  */

  /*
  showLangLevel(lang) {
    let l = this.filterLanguage.find(item => item.lang === lang?.code)?.level;
    if (l==1) { return 'Beginner'; }
    else if (l==2) { return 'Intermediate'; }
    else if (l==3) { return 'Advanced'; }
    else { return false; }
  }
  */

  //
  // COUNTRY Methods
  //

  /*
  countryChange(event) {
    this.filterCountry = event.detail.value;
    this.isFilterCountry = true;
  }

  showCountry() {
    let c = this.filterCountry;
    return countryData.find(item => item.value === c)?.text;
  }

  //
  // GENDER Methods
  //

  genderChange(event) {
    this.filterGender = event.detail.value;
    this.isFilterGender = true;
  }

  showGender() {
    let g = this.filterGender;
    if (g=='male') { return "Male" }
    else if (g=='female') { return "Female" }
    else if (g=='other') { return "Other" }
    else { return false; }
  }

  //
  // AGE Methods
  //

  ageChange(event) {
    this.filterAge = event.detail.value;
    this.isFilterAge = true;
  }

  showAge() {
    let a = this.filterAge;
    if (a['lower'] && a['upper']) {
      return 'between ' + a['lower'] + ' and ' + a['upper'];
    } else {
      return false;
    }
  }

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