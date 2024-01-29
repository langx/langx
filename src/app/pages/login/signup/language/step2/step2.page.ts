import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

import { Language } from 'src/app/models/locale/Language';
import { Languages } from 'src/app/models/locale/Languages';
import { selectLanguagesInterface } from 'src/app/models/types/selectLanguages.interface';
import { selectLanguagesAction } from 'src/app/store/actions/auth.action';
import {
  isLoadingSelector,
  selectedLanguagesSelector,
} from 'src/app/store/selectors/auth.selector';
import { languagesSelector } from 'src/app/store/selectors/locale.selector';

@Component({
  selector: 'app-step2',
  templateUrl: './step2.page.html',
  styleUrls: ['./step2.page.scss'],
})
export class Step2Page implements OnInit {
  public progress: number = 0.6;
  search: string;

  isLoading$: Observable<boolean>;
  languages$: Observable<Languages> = null;
  languages: Language[];

  motherLanguage: string;
  studyLanguages: string[] = [];
  disabledStatus: { [key: string]: boolean } = {};

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

    this.store
      .pipe(select(selectedLanguagesSelector))
      .subscribe((data) => {
        this.motherLanguage = data?.motherLanguage;
        this.studyLanguages = data?.studyLanguages || [];
      })
      .unsubscribe();

    this.languages$ = this.store.pipe(select(languagesSelector));
    this.languages$
      .subscribe((data) => {
        this.languages = data?.languages.filter(
          (language) => language.code !== this.motherLanguage
        );
      })
      .unsubscribe();
  }

  MAXNUMBER_STUDYING = 5;
  checkboxChange(event, langCode) {
    if (event.detail.checked) {
      if (this.studyLanguages.length < this.MAXNUMBER_STUDYING) {
        this.studyLanguages.push(langCode);
        if (this.studyLanguages.length == this.MAXNUMBER_STUDYING) {
          for (const lang of this.languages) {
            if (!this.studyLanguages.includes(lang.code)) {
              this.disabledStatus[lang.code] = true;
            }
          }
        }
      } else {
        this.presentToast(
          `You can only select ${this.MAXNUMBER_STUDYING} checkboxes.`,
          'danger'
        );
      }
    } else {
      this.studyLanguages = this.studyLanguages.filter(
        (item) => item !== langCode
      );
      if (this.studyLanguages.length < this.MAXNUMBER_STUDYING) {
        for (const lang of this.languages) {
          if (!this.studyLanguages.includes(lang.code)) {
            this.disabledStatus[lang.code] = false;
          }
        }
      }
    }
  }

  onSubmit() {
    if (this.studyLanguages.length < 1) {
      this.presentToast('Please select at least one study language.', 'danger');
      return;
    } else if (!this.motherLanguage) {
      this.presentToast(
        'Please go back to select a mother language.',
        'danger'
      );
      return;
    }
    this.step2Completed();
  }

  step2Completed() {
    const request: selectLanguagesInterface = {
      motherLanguage: this.motherLanguage,
      studyLanguages: this.studyLanguages,
    };

    this.store.dispatch(selectLanguagesAction({ request }));
    this.router.navigate(['/', 'signup', 'language', 'step3']);

    // console.log('step2 completed');
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
