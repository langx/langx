import { Component, EventEmitter, OnInit } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Observable } from 'rxjs';
import { Store, select } from '@ngrx/store';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ModalController, ToastController } from '@ionic/angular';

// Interface Imports
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { User } from 'src/app/models/User';
import { Language } from 'src/app/models/Language';
import { createLanguageRequestInterface } from 'src/app/models/types/requests/createLanguageRequest.interface';
import { deleteLanguageRequestInterface } from 'src/app/models/types/requests/deleteLanguageRequest.interface';
import { updateLanguageRequestInterface } from 'src/app/models/types/requests/updateLanguageRequest.interface';

// Component Imports
import { ImageCropComponent } from 'src/app/components/image-crop/image-crop.component';
import { EditLanguageComponent } from 'src/app/components/edit-language/edit-language/edit-language.component';
import { AddLanguageComponent } from 'src/app/components/add-language/add-language/add-language.component';

// Selector and Action Imports
import { updateUserAction } from 'src/app/store/actions/user.action';
import {
  uploadOtherPhotosAction,
  uploadProfilePictureAction,
} from 'src/app/store/actions/bucket.action';
import {
  createLanguageAction,
  deleteLanguageAction,
  updateLanguageAction,
} from 'src/app/store/actions/language.action';
import {
  currentUserSelector,
  editProfileErrorSelector,
  isLoadingSelector,
} from 'src/app/store/selectors/auth.selector';

@Component({
  selector: 'app-edit',
  templateUrl: './edit.page.html',
  styleUrls: ['./edit.page.scss'],
})
export class EditPage implements OnInit {
  form: FormGroup;

  isLoading$: Observable<boolean> = null;
  currentUser$: Observable<User | null> = null;
  currentUser: User | null = null;
  studyLanguages: Language[] = [];

  constructor(
    private store: Store,
    private modalCtrl: ModalController,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.initValues();
    this.initForm();
  }

  initValues() {
    this.currentUser$ = this.store.pipe(select(currentUserSelector));
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));

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
      });

      if (!image) return;

      const modal = await this.modalCtrl.create({
        component: ImageCropComponent,
        componentProps: {
          image: image,
        },
      });
      modal.present();

      await modal.onDidDismiss().then((data) => {
        if (data?.data) {
          // URL to Blob
          let blob = this.dataURLtoBlob(data.data);

          // Blob to File
          let file = new File([blob], this.currentUser.$id, {
            type: blob.type,
          });

          // Upload File
          if (which == 'pp') {
            this.store.dispatch(
              uploadProfilePictureAction({
                request: file,
                currentUserId: this.currentUser.$id,
              })
            );
          }
          if (which == 'other') {
            this.store.dispatch(
              uploadOtherPhotosAction({
                request: file,
                currentUserId: this.currentUser.$id,
                otherPhotos: this.currentUser.otherPhotos,
              })
            );
          }
        } else {
          this.presentToast('Image not selected properly.', 'danger');
        }
      });
    } catch (e) {
      console.log(e);
    }
  }

  deletePP() {
    this.presentToast('At least one profile picture required.', 'danger');
  }

  async deleteOtherPhotos(image) {
    const newOtherPhotos = this.currentUser.otherPhotos.filter(
      (item) => item !== image
    );

    const request = {
      userId: this.currentUser?.$id,
      data: {
        $id: this.currentUser.$id,
        otherPhotos: newOtherPhotos,
      },
    };

    this.store.dispatch(updateUserAction({ request }));
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
        return;
      }

      // Check if the language is already added
      if (this.currentUser.languageArray.includes(selectedLanguage.name)) {
        this.presentToast('Language already added.', 'danger');
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

  //
  // Utils
  //

  private dataURLtoBlob(dataurl: any) {
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
