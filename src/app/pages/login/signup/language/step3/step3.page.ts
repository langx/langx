import { Component, OnDestroy, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable, Subscription } from 'rxjs';

import { Account } from 'src/app/models/Account';
import { Language } from 'src/app/models/locale/Language';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { languagesSelector } from 'src/app/store/selectors/locale.selector';
import {
  languageSelectionAction,
  updateLanguageArrayAction,
} from 'src/app/store/actions/auth.action';
import {
  accountSelector,
  isCompletedLanguageSelector,
  isLoadingSelector,
  registerValidationErrorSelector,
  selectedLanguagesSelector,
} from 'src/app/store/selectors/auth.selector';

@Component({
  selector: 'app-step3',
  templateUrl: './step3.page.html',
  styleUrls: ['./step3.page.scss'],
})
export class Step3Page implements OnInit, OnDestroy {
  public progress: number = 0.9;

  languages: Language[];

  motherLanguages: Array<any> = [];
  studyLanguages: Array<any> = [];
  motherLanguageString: string;
  studyLanguagesStringArray: Array<string> = [];

  account$: Observable<Account | null>;
  isLoading$: Observable<boolean>;
  isCompletedLanguage$: Observable<boolean>;

  private subscriptions = new Subscription();

  constructor(private toastController: ToastController, private store: Store) {}

  ngOnInit() {}

  ionViewWillEnter() {
    this.resetValues();
    this.initValues();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  initValues() {
    // Data coming from store
    this.store
      .pipe(select(languagesSelector))
      .subscribe((data) => {
        this.languages = data?.languages;
      })
      .unsubscribe();

    // Init values From Store
    this.account$ = this.store.pipe(select(accountSelector));
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));
    this.isCompletedLanguage$ = this.store.pipe(
      select(isCompletedLanguageSelector)
    );

    // Present Toast if error
    this.subscriptions.add(
      this.store
        .pipe(select(registerValidationErrorSelector))
        .subscribe((error: ErrorInterface) => {
          if (error) this.presentToast(error.message, 'danger');
        })
    );

    // Init Values From Step 2
    this.store
      .pipe(select(selectedLanguagesSelector))
      .subscribe((data) => {
        this.motherLanguageString = data?.motherLanguage;
        this.studyLanguagesStringArray = data?.studyLanguages || [];
      })
      .unsubscribe();

    this.studyLanguagesStringArray.forEach((language) => {
      this.studyLanguages.push({
        name: this.languages?.find((lang) => lang.code === language).name,
        nativeName: this.languages.find((lang) => lang.code === language)
          .nativeName,
        code: language,
        level: 0,
        motherLanguage: false,
      });
    });

    this.motherLanguages = [
      {
        name: this.languages.find(
          (lang) => lang.code === this.motherLanguageString
        ).name,
        nativeName: this.languages.find(
          (lang) => lang.code === this.motherLanguageString
        ).nativeName,
        code: this.motherLanguageString,
        level: -1,
        motherLanguage: true,
      },
    ];
  }

  resetValues() {
    this.languages = [];
    this.motherLanguages = [];
    this.studyLanguages = [];
    this.motherLanguageString = null;
    this.studyLanguagesStringArray = [];
  }

  radioChecked(event, item) {
    const level = event.detail.value;
    this.studyLanguages.find((lang) => lang.code === item.code).level =
      Number(level);
  }

  async onSubmit() {
    if (this.studyLanguages.find((lang) => lang.level === 0)) {
      this.presentToast('Please select your level for all languages', 'danger');
      return;
    }

    const languages = this.motherLanguages.concat(this.studyLanguages);
    this.completeLanguages(languages);
  }

  completeLanguages(languages) {
    let languageArray: string[] = [];
    let userId: string;

    this.account$
      .subscribe((account: Account | null) => {
        userId = account.$id;
      })
      .unsubscribe();

    // Add userId to each language and fill languageArray with language codes
    languages.forEach((lang) => {
      lang.userId = userId;
      languageArray.push(lang.name);
    });
    console.log('languages:', languages);

    // Dispatch the first action
    this.store.dispatch(languageSelectionAction({ request: languages }));

    // Subscribe to the store and wait for the language selection to be successful
    this.subscriptions.add(
      this.isCompletedLanguage$.subscribe((isCompletedLanguage: boolean) => {
        // Dispatch the second action
        if (isCompletedLanguage) {
          this.store.dispatch(
            updateLanguageArrayAction({ id: userId, request: languageArray })
          );
        }
      })
    );
  }

  //
  // Present Toast
  //

  async presentToast(msg: string, color?: string) {
    const toast = await this.toastController.create({
      message: msg,
      color: color || 'primary',
      duration: 1000,
      position: 'top',
    });

    await toast.present();
  }
}
