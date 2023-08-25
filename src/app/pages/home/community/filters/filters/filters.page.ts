import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { LanguageLevelModalComponent } from 'src/app/components/language-level-modal/language-level-modal.component';
import { AuthService } from 'src/app/services/auth/auth.service';
import { countryData } from 'src/app/extras/data';

@Component({
  selector: 'app-filters',
  templateUrl: './filters.page.html',
  styleUrls: ['./filters.page.scss'],
})
export class FiltersPage implements OnInit {

  countryData = countryData;
  searchTerm: string;

  isLoading: boolean = false;
  filterData: any;
  currentUserData: any;
  
  filterLanguage: Array<any> = [];
  filterGender: string = '';
  filterCountry: string = '';
  filterAge: Object = {};

  constructor(
    private authService: AuthService,
    private modalCtrl: ModalController
  ) { }

  ngOnInit() {
    this.getUserData();
  }

  onSubmit() { 
    console.log(this.filterData);
  }

  getUserData() {
    this.authService.getUserData().then((currentUserData) => {
      this.currentUserData = currentUserData;
      console.log('currentUserData: ', currentUserData);
    }).catch((error) => {
      console.log('error: ', error);
    });
  }

  //
  // LANGUAGE methods
  //

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
      let item = { lang: lang?.code, level: data };
      this.filterLanguage.push(item);
      console.log(this.filterLanguage);
    }
  }

  showLangLevel(lang) {
    let l = this.filterLanguage.find(item => item.lang === lang?.code)?.level;
    if (l==1) { return 'Beginner'; }
    else if (l==2) { return 'Intermediate'; }
    else if (l==3) { return 'Advanced'; }
    else { return false; }
  }
  
  //
  // COUNTRY methods
  //

  countryChange(event) {
    this.filterCountry = event.detail.value;
  }

  showCountry() {
    let c = this.filterCountry;
    return countryData.find(item => item.value === c)?.text;
  }

  //
  // GENDER methods
  //
  
  genderChange(event) {
    this.filterGender = event.detail.value;
  }

  showGender() {
    let g = this.filterGender;
    if (g=='male') { return "Male" }
    else if (g=='female') { return "Female" }
    else if (g=='other') { return "Other" }
    else { return false; }
  }

  //
  // AGE methods
  //

  ageChange(event) {
    this.filterAge = event.detail.value;
    console.log(this.filterAge);
  }

  showAge() {
    let a = this.filterAge;
    if (a['lower'] && a['upper']) {
      return 'between ' + a['lower'] + ' and ' + a['upper'];
    } else {
      return false;
    }
  }

  // Reset all filters
  resetFilter(){
    this.filterData = {};
    this.filterLanguage = [];
    this.filterGender = '';
    this.filterCountry = '';
  }

}