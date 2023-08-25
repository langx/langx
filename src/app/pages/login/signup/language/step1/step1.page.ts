import { Component, OnInit } from '@angular/core';
import { languagesData } from '../../../../../extras/data';
import { NavigationExtras, Router } from '@angular/router';
import { AlertController } from '@ionic/angular';

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
    private alertController: AlertController
  ) { }

  ngOnInit() {
  }

  radioChecked(event){
    this.motherLanguage = event.detail.value;
  }

  onSubmit(){
    if(!this.motherLanguage){
      this.showAlert('Please select your mother language');
      return;
    }
    this.step1Completed();
  }

  step1Completed(){
    this.isLoading = true; //showLoader();
        const navData: NavigationExtras = {
      queryParams: {
        motherLanguage: this.motherLanguage
      }
    };
    this.isLoading = false; //hideLoader();
    this.router.navigate(['/','login','signup','language','step2'], navData);
    console.log('step1 completed');
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