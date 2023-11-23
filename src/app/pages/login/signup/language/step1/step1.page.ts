import { Component, OnInit } from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

import { Language } from 'src/app/models/locale/Language';
import { Languages } from 'src/app/models/locale/Languages';
import { languagesSelector } from 'src/app/store/selectors/locale.selector';

@Component({
  selector: 'app-step1',
  templateUrl: './step1.page.html',
  styleUrls: ['./step1.page.scss'],
})
export class Step1Page implements OnInit {
  public progress: number = 0.33;
  isLoading: boolean = false;
  term: string;

  languages$: Observable<Languages> = null;
  languages: Language[];

  motherLanguage: string;

  constructor(
    private store: Store,
    private router: Router,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.initValues();
  }

  initValues() {
    this.languages$ = this.store.pipe(select(languagesSelector));
    this.languages$
      .subscribe((data) => {
        this.languages = data?.languages;
      })
      .unsubscribe();
  }

  radioChecked(event) {
    console.log(event.detail.value);
    this.motherLanguage = event.detail.value;
    console.log(this.motherLanguage);
  }

  onSubmit() {
    if (!this.motherLanguage) {
      this.presentToast('Please select your mother language', 'danger');
      return;
    }

    this.step1Completed();
  }

  step1Completed() {
    this.isLoading = true;
    const navData: NavigationExtras = {
      queryParams: {
        motherLanguage: this.motherLanguage,
      },
    };
    this.router.navigate(
      ['/', 'login', 'signup', 'language', 'step2'],
      navData
    );
    this.isLoading = false;
    console.log('step1 completed');
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
