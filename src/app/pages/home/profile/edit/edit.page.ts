import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import {
  LoadingController,
  ModalController,
  ToastController,
} from '@ionic/angular';
import { Subscription } from 'rxjs';
import { ImageCropComponent } from 'src/app/components/image-crop/image-crop.component';

import { AuthService } from 'src/app/services/auth/auth.service';
import { Auth2Service } from 'src/app/services/auth/auth2.service';
import { UserService } from 'src/app/services/user/user.service';
import { LanguageService } from 'src/app/services/user/language.service';

@Component({
  selector: 'app-edit',
  templateUrl: './edit.page.html',
  styleUrls: ['./edit.page.scss'],
})
export class EditPage implements OnInit {
  isLoading: boolean = false;
  currentUser: any;

  cUser: Subscription;
  cUserDoc: any;
  cUserSession: any;

  uploadedImageURL: string = '';

  constructor(
    private authService: AuthService,
    private auth2Service: Auth2Service,
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

  ngOnDestroy() {
    this.cUser.unsubscribe();
  }

  getProfileInfo() {
    //showLoader();
    this.isLoading = true;
    this.authService.getUserData();

    this.cUser = this.authService._cUser.subscribe((cUser) => {
      if (cUser) {
        this.currentUser = cUser;
        this.textAreaValue = cUser.aboutMe;
      }
    });

    this.auth2Service
      .getUser()
      .subscribe((cUser) => {
        if (cUser) {
          console.log(cUser);
          this.cUserSession = cUser;
        }
      })
      .unsubscribe();
    // TODO: Unsubscribe may not be necessary to update the user info

    this.userService.getUserDoc(this.cUserSession.$id).then((user) => {
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
            //  if (which == 'other') this.addOtherPhotos();

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
      // TODO: UserID should be added to the file name
      const currentDate = Date.now();
      var file = new File([blob], this.cUserDoc.$id, { type: blob.type });

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
      .updateUserDoc(this.cUserDoc.$id, {
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
      this.currentUser.otherPhotos.push(this.uploadedImageURL);
      this.uploadedImageURL = '';
    }
    await this.authService.updateUserOtherPhotos(this.currentUser).then(() => {
      this.presentToast('Other Image Added.');
      this.isLoading = false;
    });
  }

  deleteOtherPhotos(image) {
    this.isLoading = true;
    this.currentUser.otherPhotos = this.currentUser.otherPhotos.filter(
      (item) => item !== image
    );
    this.authService.updateUserOtherPhotos(this.currentUser).then(() => {
      this.presentToast('Other Image Deleted.');
      this.isLoading = false;
    });
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
      .updateUserDoc(this.cUserSession.$id, { aboutMe: this.cUserDoc.aboutMe })
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
        this.presentToast(`${language.name} language deleted.`);
        this.cUserDoc.languages = this.cUserDoc.languages.filter(
          (lang) => lang.$id !== language.$id
        );

        // Filter out the language from the array
        this.cUserDoc.languages = this.cUserDoc.languages.filter(
          (lang) => lang.$id !== language.$id
        );
        // Update languageArray
        const index = this.cUserDoc.languageArray.indexOf(language.name);
        if (index > -1) {
          this.cUserDoc.languageArray.splice(index, 1);
        }
        // Update user doc with new languageArray
        this.userService
          .updateUserDoc(this.cUserSession.$id, {
            languageArray: this.cUserDoc.languageArray,
          })
          .then(() => {
            console.log('Language Array Updated');
          })
          .catch((error) => {
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
