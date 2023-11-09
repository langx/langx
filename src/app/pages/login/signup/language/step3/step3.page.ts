import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

import { languagesData } from 'src/app/extras/data';
import { Account } from 'src/app/models/Account';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import {
  languageSelectionAction,
  updateLanguageArrayAction,
} from 'src/app/store/actions/register.action';
import {
  accountSelector,
  isLanguageDoneSelector,
  isLoadingSelector,
  validationErrorSelector,
} from 'src/app/store/selectors';

@Component({
  selector: 'app-step3',
  templateUrl: './step3.page.html',
  styleUrls: ['./step3.page.scss'],
})
export class Step3Page implements OnInit {
  public progress: number = 1;

  motherLanguages: Array<any> = [];
  studyLanguages: Array<any> = [];

  account$: Observable<Account | null>;
  isLoading$: Observable<boolean>;
  isLanguageDone$: Observable<boolean>;
  validationError$: Observable<ErrorInterface | null>;

  constructor(
    private route: ActivatedRoute,
    private toastController: ToastController,
    private store: Store
  ) {}

  ngOnInit() {
    this.initValues();
  }

  initValues() {
    // Init values From Store
    this.account$ = this.store.pipe(select(accountSelector));
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));
    this.isLanguageDone$ = this.store.pipe(select(isLanguageDoneSelector));
    this.validationError$ = this.store.pipe(select(validationErrorSelector));
    this.validationError$.subscribe((error: ErrorInterface) => {
      if (error) this.presentToast(error.message, 'danger');
    });

    // Init Values From Step 2
    const data: any = this.route.snapshot.queryParams;
    console.log('navData coming from step2', data);
    let studyLanguages: Array<string> = [];
    let motherLanguage = data.motherLanguage;

    if (typeof data.studyLanguages === 'string') {
      studyLanguages.push(data.studyLanguages);
    } else {
      studyLanguages = data.studyLanguages;
    }

    studyLanguages.forEach((language) => {
      this.studyLanguages.push({
        name: languagesData.find((lang) => lang.code === language).name,
        nativeName: languagesData.find((lang) => lang.code === language)
          .nativeName,
        code: language,
        level: 0,
        motherLanguage: false,
      });
    });

    this.motherLanguages = [
      {
        name: languagesData.find((lang) => lang.code === motherLanguage).name,
        nativeName: languagesData.find((lang) => lang.code === motherLanguage)
          .nativeName,
        code: motherLanguage,
        level: -1,
        motherLanguage: true,
      },
    ];
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
      languageArray.push(lang.code);
    });
    console.log('languages:', languages);

    // Dispatch the first action
    this.store.dispatch(languageSelectionAction({ request: languages }));

    // Subscribe to the store and wait for the language selection to be successful
    this.isLanguageDone$
      .subscribe((isLanguageDone: boolean) => {
        // Dispatch the second action
        if (isLanguageDone) {
          this.store.dispatch(
            updateLanguageArrayAction({ id: userId, request: languageArray })
          );
        }
      });
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
