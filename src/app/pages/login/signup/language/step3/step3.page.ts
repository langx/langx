import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { languagesData } from 'src/app/extras/data';
import { AlertController } from '@ionic/angular';
import { Auth2Service } from 'src/app/services/auth/auth2.service';
import { LanguageService } from 'src/app/services/user/language.service';

@Component({
  selector: 'app-step3',
  templateUrl: './step3.page.html',
  styleUrls: ['./step3.page.scss'],
})
export class Step3Page implements OnInit {
  public progress: number = 1;
  isLoading: boolean = false;
  fill = 'clear';

  motherLanguages: Array<any> = [];
  studyLanguages: Array<any> = [];

  constructor(
    private route: ActivatedRoute,
    private alertController: AlertController,
    private auth2Service: Auth2Service,
    private languageService: LanguageService
  ) {}

  ngOnInit() {
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
    this.studyLanguages.find((lang) => lang.code === item.code).level =
      event.detail.value;
  }

  async onSubmit() {
    if (this.studyLanguages.find((lang) => lang.level === 0)) {
      this.showAlert('Please select your level for all languages');
      return;
    }
    this.completeLanguages(this.motherLanguages, this.studyLanguages);
  }

  completeLanguages(motherLanguages, studyLanguages) {
    let user: any;
    this.auth2Service
      .getUser()
      .subscribe((u) => {
        user = u;
      })
      .unsubscribe();
    // console.log('user:', user);

    console.log('motherLanguages:', motherLanguages);
    console.log('studyLanguages:', studyLanguages);

    motherLanguages.forEach((motherlang) => {
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

    studyLanguages.forEach((studyLang) => {
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
