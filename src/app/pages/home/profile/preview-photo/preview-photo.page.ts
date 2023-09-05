import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-preview-photo',
  templateUrl: './preview-photo.page.html',
  styleUrls: ['./preview-photo.page.scss'],
})
export class PreviewPhotoPage implements OnInit {

  @Input() photos: any;
  @Input() index: any;

  constructor(
    private modalCtrl: ModalController
  ) { }

  ngOnInit() {
    console.log(this.index);
  }

  close() {
    this.modalCtrl.dismiss();
  }

}