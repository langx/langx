import { Component, OnInit } from '@angular/core';
import { languagesData } from 'src/app/extras/data';
import { ActivatedRoute } from '@angular/router';
import { NavigationExtras, Router } from '@angular/router';
import { AlertController } from '@ionic/angular';

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
  studyLanguages: Array<string> = [];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    const data: any = this.route.snapshot.queryParams;
    console.log('navData coming from step1', data);
    this.motherLanguage = data.motherLanguage;
  }

  // TODO: #142 [BUG] : The checkboxChecked() function is working properly
  // But the html displays much higher than 5 checkboxes as checked even if it's not in the array
  checkboxChecked(event) {
    if (this.studyLanguages.includes(event.detail.value)) {
      this.studyLanguages = this.studyLanguages.filter(
        (item) => item !== event.detail.value
      );
    } else if (this.studyLanguages.length < 5) {
      this.studyLanguages.push(event.detail.value);
    }
    console.log(this.studyLanguages);
  }

  onSubmit() {
    if (this.studyLanguages.length < 1) {
      this.showAlert('Please select at least one study language.');
      return;
    } else if (!this.motherLanguage) {
      this.showAlert('Please go back to select a mother language.');
      return;
    }
    this.step2Completed();
  }

  step2Completed() {
    this.isLoading = true; //showLoader();
    const navData: NavigationExtras = {
      queryParams: {
        motherLanguage: this.motherLanguage,
        studyLanguages: this.studyLanguages,
      },
    };
    this.isLoading = false; //hideLoader();
    this.router.navigate(
      ['/', 'login', 'signup', 'language', 'step3'],
      navData
    );
    console.log('step2 completed');
  }

  async showAlert(msg: string) {
    const alert = await this.alertController.create({
      header: 'Alert',
      //subHeader: 'Important message',
      message: msg,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
