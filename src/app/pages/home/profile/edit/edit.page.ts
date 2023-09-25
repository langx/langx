import { Component, OnInit } from '@angular/core';
import {
  Storage,
  getDownloadURL,
  ref,
  uploadBytes,
} from '@angular/fire/storage';
import { Router } from '@angular/router';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import {
  LoadingController,
  ModalController,
  ToastController,
} from '@ionic/angular';
import { Subscription } from 'rxjs';
import { AuthService } from 'src/app/services/auth/auth.service';
import { Auth2Service } from 'src/app/services/auth/auth2.service';
import { UserService } from 'src/app/services/user/user.service';
import { ImageCropComponent } from 'src/app/components/image-crop/image-crop.component';

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
    private toastController: ToastController,
    private router: Router,
    private storage: Storage,
    private modalCtrl: ModalController,
    private loadingCtrl: LoadingController
  ) {}

  ngOnInit() {
    this.getProfileInfo();
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

  ngOnDestroy() {
    this.cUser.unsubscribe();
  }

  //
  // To Upload Profile and Other Images
  //

  async selectImage(which: string) {
    try {
      if (Capacitor.getPlatform() != 'web') await Camera.requestPermissions();

      const image = await Camera.getPhoto({
        quality: 100,
        allowEditing: true,
        source: CameraSource.Prompt,
        resultType: CameraResultType.DataUrl,
      }).catch((error) => {
        console.log(error);
        this.loadingCtrl.dismiss();
      });

      const loading = await this.loadingCtrl.create();
      await loading.present();

      const modal = await this.modalCtrl.create({
        component: ImageCropComponent,
        componentProps: {
          image: image,
        },
      });

      modal.present();
      this.loadingCtrl.dismiss();

      await modal.onDidDismiss().then((data) => {
        if (!data.data) return;
        console.log(data.data);
        let blob = this.dataURLtoBlob(data.data);
        this.uploadImage(blob, image).then((url) => {
          this.uploadedImageURL = url;
          // console.log(this.uploadedImageURL);
          if (which == 'pp') this.changePP();
          if (which == 'other') this.addOtherPhotos();
        });
      });
    } catch (e) {
      console.log(e);
      this.loadingCtrl.dismiss();
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
    try {
      const currentDate = Date.now();
      const filePath = `users/${this.currentUser.uid}/${currentDate}.${imageData.format}`;
      const fileRef = ref(this.storage, filePath);
      const task = await uploadBytes(fileRef, blob);
      console.log('task: ', task);
      const url = getDownloadURL(fileRef);
      return url;
    } catch (e) {
      throw e;
    }
  }

  async changePP() {
    this.isLoading = true;

    if (this.uploadedImageURL != '') {
      this.currentUser.photo = this.uploadedImageURL;
      this.uploadedImageURL = '';
    }

    await this.authService
      .updateUserProfilePictureURL(this.currentUser)
      .then(() => {
        this.presentToast('Profile Picture Updated.');
        this.isLoading = false;
      });
  }

  deletePP() {
    this.presentToast('At least one profile picture required.');
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

  // TODO: There is a bug while saving aboutMe.
  // Response: 	
  // {
  //   message	"Server Error"
  //   code	500
  //   type	"general_unknown"
  //   version	"1.4.2"
  // }
  saveAboutMe() {
    this.isLoading = true;
    this.userService.updateUserDoc(this.cUserSession.$id, this.cUserDoc).then(() => {
      this.presentToast('About me saved.');
      this.isLoading = false;
    }).catch((error) => {
      console.log(error);
      this.isLoading = false;
    });
  }

  //
  // Edit Languages
  //

  editLanguages() {
    this.router.navigate(['/home/profile/edit/languages']);
  }

  deleteLanguage(language) {
    this.isLoading = true;
    this.currentUser.studyLanguages = this.currentUser.studyLanguages.filter(
      (item) => item !== language
    );
    this.currentUser.languagesArray = this.currentUser.languagesArray.filter(
      (item) => item !== language.code
    );
    this.authService.updateUserStudyLanguagesData(this.currentUser).then(() => {
      this.presentToast('Language deleted.');
      this.isLoading = false;
    });
  }

  //
  // Present Toast
  //

  async presentToast(msg: string) {
    const toast = await this.toastController.create({
      message: msg,
      duration: 1500,
      position: 'bottom',
    });

    await toast.present();
  }
}
