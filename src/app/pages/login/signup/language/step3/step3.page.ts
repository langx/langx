import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { languagesData } from '../../data'
import { AlertController } from '@ionic/angular';

@Component({
  selector: 'app-step3',
  templateUrl: './step3.page.html',
  styleUrls: ['./step3.page.scss'],
})
export class Step3Page implements OnInit {

  public progress: number = 1;
  isLoading: boolean = false;
  fill = 'clear';

  motherLanguage: string;
  studyLanguages: Array<any> = [];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private alertController: AlertController
  ) { }

  ngOnInit() {
    const data: any = this.route.snapshot.queryParams;
    console.log('navData coming from step2', data);
    let studyLanguages: Array<string> = [];
    this.motherLanguage = data.motherLanguage;
    studyLanguages = data.studyLanguages;
    studyLanguages.forEach((language) => {
      this.studyLanguages.push({
        name: languagesData.find((lang) => lang.code === language).name,
        nativeName: languagesData.find((lang) => lang.code === language).nativeName,
        code: language, 
        level: 0,
      })
    })
    // console.log(this.studyLanguages);
  }

  radioChecked(event, item) {
    console.log(event.detail.value, item.code);
    this.studyLanguages.find((lang) => lang.code === item.code).level = event.detail.value;
  }

  async completeLanguages() {
    if(this.studyLanguages.find((lang) => lang.level === 0)) {
      let msg = "Please select your level for all languages";
      const alert = await this.alertController.create({
        header: 'Alert',
        //subHeader: 'Important message',
        message: msg,
        buttons: ['OK'],
      });
      await alert.present();
      return;
    } else {
      this.isLoading = true;
      setTimeout(() => {
        this.isLoading = false;
        this.router.navigateByUrl('/home');
      }, 2000)
    }
  }

}