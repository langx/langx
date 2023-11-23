import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavigationExtras, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

import { Language } from 'src/app/models/locale/Language';
import { Languages } from 'src/app/models/locale/Languages';
import { languagesSelector } from 'src/app/store/selectors/locale.selector';

@Component({
  selector: 'app-step2',
  templateUrl: './step2.page.html',
  styleUrls: ['./step2.page.scss'],
})
export class Step2Page implements OnInit {
  public progress: number = 0.66;
  isLoading: boolean = false;
  search: string;

  languages$: Observable<Languages> = null;
  languages: Language[];

  motherLanguage: string;
  studyLanguages: string[] = [];
  disabledStatus: { [key: string]: boolean } = {};

  constructor(
    private store: Store,
    private router: Router,
    private route: ActivatedRoute,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.initValues();
  }

  initValues() {
    // Data coming from step1
    const data: any = this.route.snapshot.queryParams;
    console.log('navData coming from step1', data);
    this.motherLanguage = data.motherLanguage;

    // Data coming from store
    this.languages$ = this.store.pipe(select(languagesSelector));
    this.languages$
      .subscribe((data) => {
        this.languages = data?.languages;
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
    this.isLoading = true;
    const navData: NavigationExtras = {
      queryParams: {
        motherLanguage: this.motherLanguage,
        studyLanguages: this.studyLanguages,
      },
    };
    this.router.navigate(
      ['/', 'login', 'signup', 'language', 'step3'],
      navData
    );
    this.isLoading = false;
    console.log('step2 completed');
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
