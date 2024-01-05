import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ModalController } from '@ionic/angular';

import { Language } from 'src/app/models/Language';

@Component({
  selector: 'app-edit-language',
  templateUrl: './edit-language.component.html',
  styleUrls: ['./edit-language.component.scss'],
})
export class EditLanguageComponent implements OnInit {
  @Input() languages: Language[] | null = null;
  @Output() onClick: EventEmitter<any> = new EventEmitter();

  constructor(private modalCtrl: ModalController) {}

  ngOnInit() {
    // console.log('languages', this.languages);
  }

  radioChecked(event, item) {
    let updatedLanguage: Language = {
      ...item,
      level: parseInt(event.detail.value),
    };
    this.onClick.emit(updatedLanguage);
  }

  close() {
    // TODO: set modalDirection animate back, not backdown
    // IDEA: OR otherwise with no backbutton, only cross button!
    this.modalCtrl.dismiss();
  }
}
