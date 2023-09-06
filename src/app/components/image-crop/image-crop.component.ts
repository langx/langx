import { Component, Input, OnInit } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ModalController } from '@ionic/angular';
import { ImageCroppedEvent, LoadedImage } from 'ngx-image-cropper';

@Component({
  selector: 'app-image-crop',
  templateUrl: './image-crop.component.html',
  styleUrls: ['./image-crop.component.scss'],
})
export class ImageCropComponent  implements OnInit {

  @Input() image: any;

  imageChangedEvent: any = null;
  croppedImage: any = null;

  constructor(
    private modalCtrl: ModalController,
    private sanitizer: DomSanitizer
  ) { }

  ngOnInit() {
    console.log(this.image); 
  }

  //
  // Image Cropper Test
  //

  imageCropped(event: ImageCroppedEvent) {
    this.croppedImage = this.sanitizer.bypassSecurityTrustUrl(event.objectUrl);
    // event.blob can be used to upload the cropped image
  }

  imageLoaded(image?: LoadedImage) {
      // show cropper
  }

  loadImageFailed() {
      // show message
  }

  close() {
    this.modalCtrl.dismiss();
  }

}