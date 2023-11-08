import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavigationExtras, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';

import { languagesData } from 'src/app/extras/data';

@Component({
  selector: 'app-step2',
  templateUrl: './step2.page.html',
  styleUrls: ['./step2.page.scss'],
})
export class Step2Page implements OnInit {
  public progress: number = 0.66;
  isLoading: boolean = false;
  public languages = languagesData;
  search: string;

  motherLanguage: string;
  studyLanguages: string[] = [];
  disabledStatus: { [key: string]: boolean } = {};

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    const data: any = this.route.snapshot.queryParams;
    console.log('navData coming from step1', data);
    this.motherLanguage = data.motherLanguage;
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
