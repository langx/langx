import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { languagesData } from 'src/app/extras/data';
import { AlertController } from '@ionic/angular';
import { AuthService } from 'src/app/services/auth/auth.service';

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
    private router: Router,
    private route: ActivatedRoute,
    private alertController: AlertController,
    private authService: AuthService
  ) { }

  ngOnInit() {
    const data: any = this.route.snapshot.queryParams;
    console.log('navData coming from step2', data);
    let studyLanguages: Array<string> = [];
    let motherLanguage = data.motherLanguage;
    
    if(typeof(data.studyLanguages) === 'string') {
      studyLanguages.push(data.studyLanguages);
    } else {
      studyLanguages = data.studyLanguages;
    }

    studyLanguages.forEach((language) => {
      this.studyLanguages.push({
        name: languagesData.find((lang) => lang.code === language).name,
        nativeName: languagesData.find((lang) => lang.code === language).nativeName,
        code: language, 
        level: 0,
      });
    })

    this.motherLanguages = [{
      name: languagesData.find((lang) => lang.code === motherLanguage).name,
      nativeName: languagesData.find((lang) => lang.code === motherLanguage).nativeName,
      code: motherLanguage,
      level: -1,
    }];

  }

  radioChecked(event, item) {
    this.studyLanguages.find((lang) => lang.code === item.code).level = event.detail.value;
  }

  async onSubmit(){
    if(this.studyLanguages.find((lang) => lang.level === 0)) {
      this.showAlert("Please select your level for all languages");
      return;
    } 
    this.completeLanguages(this.motherLanguages, this.studyLanguages);
  }

  completeLanguages(motherLanguages, studyLanguages) {
      //showLoader();
      this.isLoading = true;

      let form = { motherLanguages: motherLanguages, studyLanguages: studyLanguages };
      console.log('languages', form);
      
      try {
        this.authService.updateUserLanguageData(form).then(() => {
          console.log('updateUserLanguageData setted in DB');
          this.router.navigateByUrl('/home');
          //hideLoader();
          this.isLoading = false;
        });
      } catch (error) {
        console.log('error:', error);
        this.isLoading = false;
        this.showAlert("Please try again later."); 
      }
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