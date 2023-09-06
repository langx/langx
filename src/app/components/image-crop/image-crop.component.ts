import { Component, Input, OnInit } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Capacitor } from '@capacitor/core';
import { LoadingController, ModalController } from '@ionic/angular';
import { ImageCroppedEvent, LoadedImage } from 'ngx-image-cropper';

@Component({
  selector: 'app-image-crop',
  templateUrl: './image-crop.component.html',
  styleUrls: ['./image-crop.component.scss'],
})
export class ImageCropComponent  implements OnInit {

  @Input() image: any;

  croppedImage: any = null;
  // TODO: should be tested in mobile
  isMobile = Capacitor.getPlatform() !== 'web';

  constructor(
    private modalCtrl: ModalController,
    private loadingCtrl: LoadingController,
    private sanitizer: DomSanitizer
  ) { }

  ngOnInit() {
    this.loadingCtrl.create();
  }

  //
  // Image Cropper Test
  //

  imageCropped(event: ImageCroppedEvent) {
    this.croppedImage = this.sanitizer.bypassSecurityTrustUrl(event.objectUrl);
    // event.blob can be used to upload the cropped image
  }

  imageLoaded(image?: LoadedImage) {
    this.loadingCtrl.dismiss();
  }

  loadImageFailed() {
    this.loadingCtrl.dismiss();
    // TODO: here trigger a toast message and exit the modal
    console.log('Image Load Failed');
  }

  close() {
    this.modalCtrl.dismiss();
  }

}