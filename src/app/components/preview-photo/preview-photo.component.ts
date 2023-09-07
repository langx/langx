import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-preview-photo',
  templateUrl: './preview-photo.component.html',
  styleUrls: ['./preview-photo.component.scss'],
})
export class PreviewPhotoComponent  implements OnInit {

  @Input() photos: any;

  constructor(
    private modalCtrl: ModalController
  ) { }

  ngOnInit() {
  }

  close() {
    this.modalCtrl.dismiss();
  }

}