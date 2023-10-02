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
  ) {}

  ngOnInit() {
    const languagesArray: any = this.router.getCurrentNavigation().extras.state;

    // remove languages already selected
    this.languageData = languagesData.filter(
      (language) => !languagesArray.includes(language.code)
    );
  }

  onSubmit() {
    console.log('submit:' + this.selectedLanguage);
    if (!this.selectedLanguage) {
      this.presentToast('Please select a language.', 'danger');
      return;
    }
    this.router.navigate(['/home/profile/edit/new/next'], {
      state: this.selectedLanguage,
    });
  }

  changeLang(event) {
    const val = event.target.value;
    languagesData.find((language) => {
      if (language.code === val) {
        this.selectedLanguage = language;
      }
    });
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
