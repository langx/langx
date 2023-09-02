import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { languagesData } from 'src/app/extras/data';

@Component({
  selector: 'app-new',
  templateUrl: './new.page.html',
  styleUrls: ['./new.page.scss'],
})
export class NewPage implements OnInit {

  searchTerm: string;
  languageData: any;
  selectedLanguage: any;

  isLoading: boolean = false;

  constructor(
    private router: Router,
    private toastController: ToastController
  ) { }

  ngOnInit() {
    const languagesArray: any = this.router.getCurrentNavigation().extras.state;

    // remove languages already selected
    this.languageData = languagesData.filter((language) => !languagesArray.includes(language.code));
  }

  onSubmit() {
    console.log('submit');
    if(!this.selectedLanguage) {
      this.presentToast('Please select a language.');
      return;
    }
    this.router.navigate(['/home/profile/edit/languages/new/next'], { state: this.selectedLanguage });
  }

  changeLang(event) {
    this.selectedLanguage = event.target.value;
  }

  //
  // Present Toast
  //

  async presentToast(msg: string) {
    const toast = await this.toastController.create({
      message: msg,
      duration: 1500,
      position: 'bottom',
    });

    await toast.present();
  }

}