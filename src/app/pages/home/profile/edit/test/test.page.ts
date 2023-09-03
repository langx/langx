import { Component, OnInit } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-test',
  templateUrl: './test.page.html',
  styleUrls: ['./test.page.scss'],
})
export class TestPage implements OnInit {

  image: string = null;

  constructor() { }

  ngOnInit() {
  }

  async takePicture() {
    try {
      if(Capacitor.getPlatform() != 'web') await Camera.requestPermissions();

      const image = await Camera.getPhoto({
        quality: 100,
        // allowEditing: false,
        source: CameraSource.Prompt,
        resultType: CameraResultType.DataUrl
      }).then((image) => {
        console.log('image:', image);
        this.image = image.dataUrl;
      }).catch((error) => {
        console.log(error);
      })
      
    } catch (e) {
      console.log(e); 
    }
      
  }

}