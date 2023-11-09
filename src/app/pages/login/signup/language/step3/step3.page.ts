import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

import { languagesData } from 'src/app/extras/data';
import { Account } from 'src/app/models/Account';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { AuthService } from 'src/app/services/auth/auth.service';
import { LanguageService } from 'src/app/services/user/language.service';
import { UserService } from 'src/app/services/user/user.service';
import { languageSelectionAction } from 'src/app/store/actions/register.action';
import {
  accountSelector,
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
  validationError$: Observable<ErrorInterface | null>;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private toastController: ToastController,
    private authService: AuthService,
    private languageService: LanguageService,
    private userService: UserService,
    private store: Store
  ) {}

  ngOnInit() {
    this.initValues();
  }

  initValues() {
    // Init values From Store
    this.account$ = this.store.pipe(select(accountSelector));
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));
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
    this.completeLanguages2(languages);
  }

  completeLanguages2(languages) {
    let languageArray: string[] = [];
    // Add userId to each language
    // And fill languageArray with language codes
    this.account$
      .subscribe((account: Account | null) => {
        languages.forEach((lang) => {
          lang.userId = account.$id;
          languageArray.push(lang.code);
        });
      })
      .unsubscribe();
    console.log('languages:', languages);

    this.store.dispatch(languageSelectionAction({ languages }));
    // TODO: dispatch languageArray to store
  }

  completeLanguages(motherLanguages, studyLanguages) {
    let user: any;
    let languageArray: Array<string> = [];

    this.authService
      .getUser()
      .subscribe((u) => {
        user = u;
      })
      .unsubscribe();

    console.log('motherLanguages:', motherLanguages);
    console.log('studyLanguages:', studyLanguages);

    try {
      // TODO: Error handling if any of the following fails
      // SCOPE: It may saved some languages and not others
      motherLanguages.forEach((motherlang) => {
        // Add the language name to the languageArray
        languageArray.push(motherlang.name);

        motherlang.userId = user.$id;
        this.languageService
          .createLanguageDoc(motherlang)
          .then((res) => {
            console.log('result:', res);
          })
          .catch((err) => {
            console.log('err:', err);
          });
      });

      // TODO: Error handling if any of the following fails
      // SCOPE: It may saved some languages and not others
      studyLanguages.forEach((studyLang) => {
        // Add the language name to the languageArray
        languageArray.push(studyLang.name);

        studyLang.userId = user.$id;
        this.languageService
          .createLanguageDoc(studyLang)
          .then((res) => {
            console.log('result:', res);
          })
          .catch((err) => {
            console.log('err:', err);
          });
      });

      // TODO: Error handling if any of the following fails
      // Add the languages to the languageArray in the user doc
      this.userService
        .updateUserDoc(user.$id, {
          languageArray: languageArray,
        })
        .then(() => {
          console.log('Language Array Updated');
        })
        .catch((error) => {
          console.log(error);
        });

      this.router.navigateByUrl('/home');
    } catch (error) {
      console.log('error:', error);
      this.presentToast('Please try again later.', 'danger');
    }
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
