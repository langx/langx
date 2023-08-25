import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-language-level-modal',
  templateUrl: './language-level-modal.component.html',
  styleUrls: ['./language-level-modal.component.scss'],
})
export class LanguageLevelModalComponent  implements OnInit {

  name: string;

  constructor(
    private modalCtrl: ModalController
  ) {}

  ngOnInit() {}

  cancel() {
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm() {
    return this.modalCtrl.dismiss(this.name, 'confirm');
  }
}