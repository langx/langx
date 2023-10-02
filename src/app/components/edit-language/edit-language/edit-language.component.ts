import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-edit-language',
  templateUrl: './edit-language.component.html',
  styleUrls: ['./edit-language.component.scss'],
})
export class EditLanguageComponent implements OnInit {
  @Input() languages: any;
  @Output() onClick: EventEmitter<any> = new EventEmitter();
  cUserSession: any;

  isLoading: boolean = false;

  constructor(private modalCtrl: ModalController) {}

  ngOnInit() {}

  radioChecked(event, selectedLanguage) {
    selectedLanguage.level = parseInt(event.detail.value);
    this.onClick.emit(selectedLanguage);
  }

  close() {
    // TODO: set modalDirection animate back, not backdown
    // IDEA: OR otherwise with no backbutton, only cross button!
    this.modalCtrl.dismiss();
  }
}
