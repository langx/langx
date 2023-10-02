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

  isLoading: boolean = false;

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

  onSubmit() {
    console.log('submit:' + this.selectedLanguage);
    if (!this.selectedLanguage) {
      this.presentToast('Please select a language.', 'danger');
      return;
    } else {
      this.onClick.emit(this.selectedLanguage);
      this.presentToast('Language added successfully.', 'success');
      this.resetForm();
      this.modalCtrl.dismiss();    }
    /*
    this.router.navigate(['/home/profile/edit/new/next'], {
      state: this.selectedLanguage,
    });
    this.resetForm();
    */
  }

  changeLang(event) {
    const val = event.target.value;
    languagesData.find((language) => {
      if (language.code === val) {
        this.selectedLanguage = language;
      }
    });
  }

  // TODO: It has bugs to oepn the modal again after closing it.
  resetForm() {
    this.searchTerm = null;
    this.languageData = null;
    this.selectedLanguage = null;
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
