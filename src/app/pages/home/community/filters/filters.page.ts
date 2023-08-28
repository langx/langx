import { Component, OnInit } from '@angular/core';
import { ModalController, NavController } from '@ionic/angular';
import { LanguageLevelModalComponent } from 'src/app/components/language-level-modal/language-level-modal.component';
import { AuthService } from 'src/app/services/auth/auth.service';
import { countryData } from 'src/app/extras/data';
import { StorageService } from 'src/app/services/storage/storage.service';
import { Router } from '@angular/router';
import { FilterService, isFilter } from 'src/app/services/filter/filter.service';

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
  
  // filters
  filterLanguage: Array<any> = [];
  filterGender: string = '';
  filterCountry: string = '';
  filterAge: Object = {};

  // flags
  isFilterLanguage: boolean = false;
  isFilterGender: boolean = false;
  isFilterCountry: boolean = false;
  isFilterAge: boolean = false;

  constructor(
    private storageService: StorageService,
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

  onSubmit() { 
    // let filterData = { 
    //   isFilterLanguage: this.isFilterLanguage,
    //   isFilterGender: this.isFilterGender,
    //   isFilterCountry: this.isFilterCountry,
    //   isFilterAge: this.isFilterAge,
    //   filterLanguage: this.filterLanguage,
    //   filterGender: this.filterGender,
    //   filterCountry: this.filterCountry,
    //   filterAge: this.filterAge,
    // };
    // this.storageService.set('filterData', filterData);
    // console.log(filterData);

    // here set filterData to filterService
    let isFilterData: isFilter = {
      isFilterLanguage: this.isFilterLanguage,
      isFilterGender: this.isFilterGender,
      isFilterCountry: this.isFilterCountry,
      isFilterAge: this.isFilterAge,
      filterLanguage: this.filterLanguage,
      filterGender: this.filterGender,
      filterCountry: this.filterCountry,
      filterAge: this.filterAge,
    }
    this.doSomething(isFilterData);
    
    this.navCtrl.setDirection('back');
    this.router.navigateByUrl('/home/community');
  }

  doSomething(param: isFilter): void {
      this.filterService.setEvent(param);
  }

  //
  // LANGUAGE Methods
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
      this.isFilterLanguage = true;
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
  // COUNTRY Methods
  //

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
    //this.storageService.remove('filterData');
  }

}