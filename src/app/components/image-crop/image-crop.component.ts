import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Capacitor } from '@capacitor/core';
import { ModalController } from '@ionic/angular';
import {
  ImageCroppedEvent,
  ImageCropperComponent,
  ImageTransform,
  LoadedImage,
} from 'ngx-image-cropper';

@Component({
  selector: 'app-image-crop',
  templateUrl: './image-crop.component.html',
  styleUrls: ['./image-crop.component.scss'],
})
export class ImageCropComponent implements OnInit {
  @Input() image: any;

  @ViewChild('imageCropper') imageCropper: ImageCropperComponent;

  croppedImage: any = null;
  transform: ImageTransform = {};

  // TODO: should be tested in mobile
  isMobile = Capacitor.getPlatform() !== 'web';

  constructor(
    private modalCtrl: ModalController,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {}

  rotate() {
    this.transform = {
      ...this.transform, // keep the previous transformation
      rotate: ((this.transform.rotate ?? 0) + 90) % 360,
    };
  }

  cropImage() {
    this.croppedImage = this.imageCropper.crop('base64')?.base64;
    this.image = null;
    this.modalCtrl.dismiss(this.croppedImage);
  }

  imageCropped(event: ImageCroppedEvent) {
    this.croppedImage = this.sanitizer.bypassSecurityTrustUrl(event.objectUrl);
    // event.blob can be used to upload the cropped image
  }

  loadImageFailed() {
    // TODO: here trigger a toast message and exit the modal
    console.log('Image Load Failed');
  }

  close() {
    this.modalCtrl.dismiss();
  }
}
