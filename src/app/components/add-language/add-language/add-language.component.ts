import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ModalController, ToastController } from '@ionic/angular';
import { languagesData } from 'src/app/extras/data';

@Component({
  selector: 'app-add-language',
  templateUrl: './add-language.component.html',
  styleUrls: ['./add-language.component.scss'],
})
export class AddLanguageComponent implements OnInit {
  @Input() languageArray: any;
  @Output() onClick: EventEmitter<any> = new EventEmitter();

  searchTerm: string;
  languageData: any;
  selectedLanguage: any;

  isShowLevels: boolean = false;

  constructor(
    private toastController: ToastController,
    private modalCtrl: ModalController
  ) {}

  ngOnInit() {
    console.log(this.languageArray);
    this.filterLanuages();
  }

  filterLanuages() {
    // remove languages already selected
    this.languageData = languagesData.filter(
      (language) => !this.languageArray.includes(language.name)
    );
    console.log(this.languageData.length);
  }

  next() {
    console.log('submit:' + this.selectedLanguage);
    if (!this.selectedLanguage) {
      this.presentToast('Please select a language.', 'danger');
      return;
    } else {
      this.isShowLevels = true;
    }
  }

  onSubmit() {
    if (!this.selectedLanguage.level) {
      this.presentToast('Please select a level.', 'danger');
      return;
    }
    this.onClick.emit(this.selectedLanguage);
    this.close();
  }

  radioChecked(event) {
    this.selectedLanguage.level = parseInt(event.detail.value);
    console.log('radioChecked:' + this.selectedLanguage.level);
  }

  changeLang(event) {
    const val = event.target.value;
    languagesData.find((language) => {
      if (language.code === val) {
        this.selectedLanguage = language;
      }
    });
  }

  close() {
    this.modalCtrl.dismiss();
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
