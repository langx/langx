import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ModalController, ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

import { Language } from 'src/app/models/locale/Language';
import { languagesSelector } from 'src/app/store/selectors/locale.selector';

@Component({
  selector: 'app-add-language',
  templateUrl: './add-language.component.html',
  styleUrls: ['./add-language.component.scss'],
})
export class AddLanguageComponent implements OnInit {
  @Input() languageArray: any;
  @Output() onClick: EventEmitter<any> = new EventEmitter();

  languages: Language[];

  searchTerm: string;
  selectedLanguage: any;
  languageData: any;

  isShowLevels: boolean = false;

  constructor(
    private store: Store,
    private toastController: ToastController,
    private modalCtrl: ModalController
  ) {}

  ngOnInit() {
    this.initValues();
    this.filterLanuages();
  }

  initValues() {
    this.store
      .pipe(select(languagesSelector))
      .subscribe((data) => {
        this.languages = data?.languages;
      })
      .unsubscribe();
  }

  filterLanuages() {
    // remove languages already selected
    this.languageData = this.languages.filter(
      (language) => !this.languageArray.includes(language.name)
    );
  }

  next() {
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
  }

  changeLang(event) {
    const val = event.target.value;
    this.languages.find((language) => {
      if (language.code === val) {
        this.selectedLanguage = { ...language };
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
