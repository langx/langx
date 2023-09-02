import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-next',
  templateUrl: './next.page.html',
  styleUrls: ['./next.page.scss'],
})
export class NextPage implements OnInit {

  isLoading: boolean = false;
  selectedLanguage: any;

  constructor(
    private router: Router,
    private toastController: ToastController
  ) { }

  ngOnInit() {
    const selectedLanguage: any = this.router.getCurrentNavigation().extras.state;
    this.selectedLanguage = selectedLanguage;
    console.log('selectedLanguage:' + selectedLanguage.code);
  }

  radioChecked(event, selectedLanguage) {
    this.selectedLanguage.level = event.detail.value;
    console.log('radioChecked:' + selectedLanguage);

  }
  
  onSubmit() {
    console.log('submit:' + this.selectedLanguage);
    if(!this.selectedLanguage.level) {
      this.presentToast('Please select a level.');
      return;
    }
    // SAVE TO DB
    this.router.navigate(['/home/profile/edit']);
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