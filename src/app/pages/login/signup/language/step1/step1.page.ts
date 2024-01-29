import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

import { Languages } from 'src/app/models/locale/Languages';
import { selectLanguagesInterface } from 'src/app/models/types/selectLanguages.interface';
import { selectLanguagesAction } from 'src/app/store/actions/auth.action';
import { languagesSelector } from 'src/app/store/selectors/locale.selector';
import {
  isLoadingSelector,
  selectedLanguagesSelector,
} from 'src/app/store/selectors/auth.selector';

@Component({
  selector: 'app-step1',
  templateUrl: './step1.page.html',
  styleUrls: ['./step1.page.scss'],
})
export class Step1Page implements OnInit {
  public progress: number = 0.4;
  search: string;

  isLoading$: Observable<boolean>;
  languages$: Observable<Languages> = null;

  motherLanguage: string;

  constructor(
    private store: Store,
    private router: Router,
    private toastController: ToastController
  ) {}

  ngOnInit() {}

  ionViewWillEnter() {
    this.initValues();
  }

  initValues() {
    // Data coming from store
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));
    this.languages$ = this.store.pipe(select(languagesSelector));

    this.store
      .pipe(select(selectedLanguagesSelector))
      .subscribe((data) => {
        this.motherLanguage = data?.motherLanguage;
      })
      .unsubscribe();
  }

  radioChecked(event) {
    this.motherLanguage = event.detail.value;
  }

  onSubmit() {
    if (!this.motherLanguage) {
      this.presentToast('Please select your mother language', 'danger');
      return;
    }

    this.step1Completed();
  }

  step1Completed() {
    const request: selectLanguagesInterface = {
      motherLanguage: this.motherLanguage,
    };

    this.store.dispatch(selectLanguagesAction({ request }));
    this.router.navigate(['/', 'signup', 'language', 'step2']);

    // console.log('step1 completed');
  }

  //
  // Present Toast
  //

  async presentToast(msg: string, color?: string) {
    const toast = await this.toastController.create({
      message: msg,
      color: color || 'primary',
      duration: 1500,
      position: 'bottom',
    });

    await toast.present();
  }
}
