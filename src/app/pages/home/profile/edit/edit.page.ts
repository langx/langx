import { Component, EventEmitter, OnInit } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Observable } from 'rxjs';
import { Store, select } from '@ngrx/store';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import {
  LoadingController,
  ModalController,
  ToastController,
} from '@ionic/angular';

// Interface Imports
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { User } from 'src/app/models/User';
import { Language } from 'src/app/models/Language';
import { createLanguageRequestInterface } from 'src/app/models/types/requests/createLanguageRequest.interface';
import { deleteLanguageRequestInterface } from 'src/app/models/types/requests/deleteLanguageRequest.interface';

// Service Imports
import { UserService } from 'src/app/services/user/user.service';

// Component Imports
import { ImageCropComponent } from 'src/app/components/image-crop/image-crop.component';
import { EditLanguageComponent } from 'src/app/components/edit-language/edit-language/edit-language.component';
import { AddLanguageComponent } from 'src/app/components/add-language/add-language/add-language.component';

// Selector and Action Imports
import { updateUserAction } from 'src/app/store/actions/user.action';
import {
  createLanguageAction,
  deleteLanguageAction,
  updateLanguageAction,
} from 'src/app/store/actions/language.action';
import {
  currentUserSelector,
  editProfileErrorSelector,
} from 'src/app/store/selectors/auth.selector';
import { updateLanguageRequestInterface } from 'src/app/models/types/requests/updateLanguageRequest.interface';

@Component({
  selector: 'app-edit',
  templateUrl: './edit.page.html',
  styleUrls: ['./edit.page.scss'],
})
export class EditPage implements OnInit {
  isLoading: boolean = false;
  form: FormGroup;

  currentUser$: Observable<User | null> = null;
  currentUser: User | null = null;
  studyLanguages: Language[] = [];

  cUserDoc: any;

  uploadedImageURL: string = '';

  constructor(
    private store: Store,
    private userService: UserService,
    private toastController: ToastController,
    private modalCtrl: ModalController,
    private loadingCtrl: LoadingController
  ) {}

  ngOnInit() {
    this.initValues();
    this.initForm();
  }

  initValues() {
    this.currentUser$ = this.store.pipe(select(currentUserSelector));

    // Set currentUser
    this.currentUser$.subscribe((user) => {
      this.currentUser = user;
      this.studyLanguages = user?.languages.filter(
        (lang) => !lang.motherLanguage
      );
    });

    // editProfileError Handling
    this.store
      .pipe(select(editProfileErrorSelector))
      .subscribe((error: ErrorInterface) => {
        if (error && error.message) this.presentToast(error.message, 'danger');
      });
  }

  initForm() {
    this.form = new FormGroup({
      aboutMe: new FormControl(this.currentUser?.aboutMe, {
        validators: [Validators.maxLength(500)],
      }),
    });
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

      if (!image) return;
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
          this.uploadImage(blob).then((url) => {
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

  async uploadImage(blob: any) {
    let url = '';
    try {
      var file = new File([blob], this.currentUser.$id, { type: blob.type });

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
      .updateUserDoc2(this.currentUser.$id, {
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
      .updateUserDoc2(this.currentUser.$id, {
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
      .updateUserDoc2(this.currentUser.$id, {
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

  saveAboutMe() {
    const request = {
      userId: this.currentUser?.$id,
      data: this.form.value,
    };
    this.store.dispatch(updateUserAction({ request }));
  }

  //
  // Edit Languages
  //

  async editLanguages() {
    const eventEmitter = new EventEmitter();
    eventEmitter.subscribe((item) => {
      const request: updateLanguageRequestInterface = {
        id: item.$id,
        data: {
          level: item?.level,
        },
      };

      this.store.dispatch(updateLanguageAction({ request }));
    });

    const modal = await this.modalCtrl.create({
      component: EditLanguageComponent,
      componentProps: {
        languages: this.studyLanguages,
        onClick: eventEmitter,
      },
    });

    modal.present();
  }

  async addLanguage() {
    const eventEmitter = new EventEmitter();
    eventEmitter.subscribe((selectedLanguage) => {
      let data: createLanguageRequestInterface = {
        userId: this.currentUser.$id,
        name: selectedLanguage.name,
        nativeName: selectedLanguage.nativeName,
        code: selectedLanguage.code,
        level: selectedLanguage.level,
        motherLanguage: false,
      };

      // If it length is 6, then don't let the user to add one more study language.
      if (this.currentUser.languages.length >= 6) {
        this.presentToast(
          'You can add max 5 Study Languages. Please remove at least one and try again.',
          'danger'
        );
        this.isLoading = false;
        return;
      }

      // Check if the language is already added
      if (this.currentUser.languageArray.includes(selectedLanguage.name)) {
        this.presentToast('Language already added.', 'danger');
        this.isLoading = false;
        return;
      }

      this.store.dispatch(
        createLanguageAction({
          request: data,
          languageArray: this.currentUser.languageArray,
        })
      );
    });

    const modal = await this.modalCtrl.create({
      component: AddLanguageComponent,
      componentProps: {
        languageArray: this.currentUser.languageArray,
        onClick: eventEmitter,
      },
    });

    modal.present();
  }

  deleteLanguage(language) {
    // If it length is 2, then don't let the user to delete last study language.
    if (this.currentUser.languages.length <= 2) {
      this.presentToast('At least one study language required.', 'danger');
      this.isLoading = false;
      return;
    }

    const request: deleteLanguageRequestInterface = {
      id: language.$id,
      name: language.name,
      userId: this.currentUser.$id,
      languageArray: this.currentUser.languageArray,
    };

    this.store.dispatch(deleteLanguageAction({ request }));
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
