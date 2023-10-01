import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import {
  LoadingController,
  ModalController,
  ToastController,
} from '@ionic/angular';
import { ImageCropComponent } from 'src/app/components/image-crop/image-crop.component';

import { AuthService } from 'src/app/services/auth/auth.service';
import { UserService } from 'src/app/services/user/user.service';
import { LanguageService } from 'src/app/services/user/language.service';

@Component({
  selector: 'app-edit',
  templateUrl: './edit.page.html',
  styleUrls: ['./edit.page.scss'],
})
export class EditPage implements OnInit {
  isLoading: boolean = false;

  cUserDoc: any;
  cUserId: string;

  uploadedImageURL: string = '';

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private languageService: LanguageService,
    private toastController: ToastController,
    private router: Router,
    private modalCtrl: ModalController,
    private loadingCtrl: LoadingController
  ) {}

  ngOnInit() {
    this.getProfileInfo();
  }

  getProfileInfo() {
    //showLoader();
    this.isLoading = true;

    this.cUserId = this.authService.getUserId();
    this.userService.getUserDoc(this.cUserId).then((user) => {
      this.cUserDoc = user;
      console.log(user);
    });

    //hideLoader();
    this.isLoading = false;
  }

  //
  // To Upload Profile and Other Images
  //

  async selectImage(which: string) {
    try {
      if (Capacitor.getPlatform() != 'web') await Camera.requestPermissions();

      // TODO: Capacitor pop up style is not good. It should be changed.
      const image = await Camera.getPhoto({
        quality: 100,
        allowEditing: true,
        source: CameraSource.Prompt,
        resultType: CameraResultType.DataUrl,
      }).catch((error) => {
        console.log(error);
        this.loadingController(false);
      });

      await this.loadingController(true);

      const modal = await this.modalCtrl.create({
        component: ImageCropComponent,
        componentProps: {
          image: image,
        },
      });

      this.loadingController(false);
      modal.present();

      await modal.onDidDismiss().then((data) => {
        if (data?.data) {
          this.loadingController(true);

          let blob = this.dataURLtoBlob(data.data);
          this.uploadImage(blob, image).then((url) => {
            this.uploadedImageURL = url;
            if (which == 'pp') this.changePP();
            if (which == 'other') this.addOtherPhotos();

            this.loadingController(false);
          });
        } else {
          console.log('No image data');
        }
      });
    } catch (e) {
      console.log(e);
      this.loadingController(false);
    }
  }

  dataURLtoBlob(dataurl: any) {
    var arr = dataurl.split(','),
      mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]),
      n = bstr.length,
      u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  async uploadImage(blob: any, imageData: any) {
    let url = '';
    try {
      const currentDate = Date.now();
      var file = new File([blob], this.cUserId, { type: blob.type });

      await this.userService.uploadFile(file).then(
        (response) => {
          console.log(response); // Success
          url = this.userService.getFileView(response.$id).href;
          console.log(url); // Resource URL
        },
        function (error) {
          console.log(error); // Failure
        }
      );
      return url;
    } catch (e) {
      throw e;
    }
  }

  async changePP() {
    this.isLoading = true;

    if (this.uploadedImageURL != '') {
      this.cUserDoc.profilePhoto = this.uploadedImageURL;
      this.uploadedImageURL = '';
    }

    await this.userService
      .updateUserDoc(this.cUserId, {
        profilePhoto: this.cUserDoc.profilePhoto,
      })
      .then(() => {
        this.presentToast('Profile Picture Updated.');
        this.isLoading = false;
      })
      .catch((error) => {
        console.log(error);
        this.isLoading = false;
      });
  }

  deletePP() {
    this.presentToast('At least one profile picture required.', 'danger');
  }

  async addOtherPhotos() {
    this.isLoading = true;

    if (this.uploadedImageURL != '') {
      this.cUserDoc.otherPhotos.push(this.uploadedImageURL);
      this.uploadedImageURL = '';
    }

    await this.userService
      .updateUserDoc(this.cUserId, {
        otherPhotos: this.cUserDoc.otherPhotos,
      })
      .then(() => {
        this.presentToast('Picture added to Other Photos.');
        this.isLoading = false;
      })
      .catch((error) => {
        console.log(error);
        this.isLoading = false;
      });
  }

  async deleteOtherPhotos(image) {
    this.isLoading = true;

    const newOtherPhotos = this.cUserDoc.otherPhotos.filter(
      (item) => item !== image
    );

    await this.userService
      .updateUserDoc(this.cUserId, {
        otherPhotos: newOtherPhotos,
      })
      .then(() => {
        // Update Markup cUserDoc
        this.updateOtherPhotos(newOtherPhotos);
        // DONE: Delete the image from storage
        this.presentToast('Picture removed from Other Photos.');
        this.isLoading = false;
      })
      .catch((error) => {
        console.log(error);
        this.isLoading = false;
      });
  }

  async updateOtherPhotos(newOtherPhotos) {
    this.cUserDoc.otherPhotos = newOtherPhotos;
  }

  //
  // Edit About Me
  //

  textAreaValue() {
    return this.cUserDoc?.aboutMe;
  }

  ionInputAboutMe(event) {
    this.cUserDoc.aboutMe = event.target.value;
  }

  saveAboutMe() {
    this.isLoading = true;
    this.userService
      .updateUserDoc(this.cUserId, { aboutMe: this.cUserDoc.aboutMe })
      .then(() => {
        this.presentToast('About me saved.');
        this.isLoading = false;
      })
      .catch((error) => {
        console.log(error);
        this.isLoading = false;
      });
  }

  //
  // Edit Languages
  //

  getStudyLanguages() {
    return this.cUserDoc?.languages.filter((lang) => !lang.motherLanguage);
  }

  editLanguages() {
    this.router.navigate(['/home/profile/edit/languages']);
  }

  deleteLanguage(language) {
    // Show Loading
    this.isLoading = true;
    console.log(language);
    // If it length is 2, then don't let the user to delete last study language.
    if (this.cUserDoc.languages.length <= 2) {
      this.presentToast('At least one study language required.', 'danger');
      this.isLoading = false;
      return;
    }
    this.languageService
      .deleteLanguageDoc(language.$id)
      .then((res) => {

        // Filter out the language from the array
        const newLanguages = this.cUserDoc.languages.filter(
          (lang) => lang.$id !== language.$id
        );
        // Update languageArray
        const index = this.cUserDoc.languageArray.indexOf(language.name);
        if (index > -1) {
          this.cUserDoc.languageArray.splice(index, 1);
        }
        // Update user doc with new languageArray
        this.userService
          .updateUserDoc(this.cUserId, {
            languageArray: this.cUserDoc.languageArray,
          })
          .then(() => {
            this.updateLanguages(newLanguages);
            this.presentToast(`${language.name} language deleted.`);
            console.log('Language Array Updated');
          })
          .catch((error) => {
            this.presentToast('Please try again later.', 'danger');
            console.log(error);
          });
        // Hide Loading
        this.isLoading = false;
      })
      .catch((error) => {
        console.log(error);
        this.presentToast('Please try again later.', 'danger');
      });
  }

  async updateLanguages(newLanguages) {
    this.cUserDoc.languages = newLanguages;
  }

  //
  // Loading Controller
  //

  async loadingController(isShow: boolean) {
    if (isShow) {
      await this.loadingCtrl
        .create({
          message: 'Please wait...',
        })
        .then((loadingEl) => {
          loadingEl.present();
        });
    } else {
      this.loadingCtrl.dismiss();
    }
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
