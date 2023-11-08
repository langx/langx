import { Component, OnInit } from '@angular/core';
import { languagesData } from '../../../../../extras/data';
import { NavigationExtras, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-step1',
  templateUrl: './step1.page.html',
  styleUrls: ['./step1.page.scss'],
})
export class Step1Page implements OnInit {
  public progress: number = 0.33;
  isLoading: boolean = false;
  public languages = languagesData;
  term: string;

  motherLanguage: string;

  constructor(
    private router: Router,
    private toastController: ToastController
  ) {}

  ngOnInit() {}

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
    this.isLoading = true; //showLoader();
    const navData: NavigationExtras = {
      queryParams: {
        motherLanguage: this.motherLanguage,
      },
    };
    this.isLoading = false; //hideLoader();
    this.router.navigate(
      ['/', 'login', 'signup', 'language', 'step2'],
      navData
    );
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
