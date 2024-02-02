import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Store, select } from '@ngrx/store';
import { Browser } from '@capacitor/browser';
import {
  BehaviorSubject,
  Observable,
  Subscription,
  combineLatest,
  filter,
  take,
} from 'rxjs';
import {
  IonModal,
  LoadingController,
  ModalController,
  ToastController,
} from '@ionic/angular';

import { environment } from 'src/environments/environment';
import { getAge, lastSeen, lastSeenExt } from 'src/app/extras/utils';
import { PreviewPhotoComponent } from 'src/app/components/preview-photo/preview-photo.component';
import { Language } from 'src/app/models/Language';
import { User } from 'src/app/models/User';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { RoomExtendedInterface } from 'src/app/models/types/roomExtended.interface';
import { roomsSelector } from 'src/app/store/selectors/room.selector';
import { activateRoomAction } from 'src/app/store/actions/message.action';
import { getRoomAction } from 'src/app/store/actions/room.action';
import {
  isLoadingSelector as isLoadingRoomSelector,
  errorSelector as errorRoomSelector,
} from 'src/app/store/selectors/room.selector';
import {
  getUserByIdAction,
  reportUserAction,
  reportUserInitialStateAction,
  blockUserAction,
  blockUserInitialStateAction,
} from 'src/app/store/actions/user.action';
import {
  errorSelector as errorUserSelector,
  isLoadingSelector as isLoadingUserSelector,
  reportSelector,
  userSelector,
} from 'src/app/store/selectors/user.selector';
import {
  isLoadingSelector as isLoadingAuthSelector,
  blockUserErrorSelector,
  blockUserSuccessSelector,
  currentUserSelector,
} from 'src/app/store/selectors/auth.selector';

@Component({
  selector: 'app-user',
  templateUrl: './user.page.html',
  styleUrls: ['./user.page.scss'],
})
export class UserPage implements OnInit {
  @ViewChild('reportUserModal') reportUserModal: IonModal;
  @ViewChild('blockUserModal') blockUserModal: IonModal;

  subscription: Subscription;

  userId: string;
  user$: Observable<User>;
  currentUser$: Observable<User>;

  studyLanguages: Language[] = [];
  motherLanguages: Language[] = [];
  gender: string = null;
  profilePhoto: URL = null;
  otherPhotos: URL[] = [];
  badges: string[] = [];

  reason: string;

  rooms$: Observable<RoomExtendedInterface[] | null> = null;

  constructor(
    private store: Store,
    private router: Router,
    private route: ActivatedRoute,
    private modalCtrl: ModalController,
    private toastController: ToastController,
    private loadingCtrl: LoadingController
  ) {}

  async ngOnInit() {
    this.initValues();
  }

  ionViewWillEnter() {
    this.subscription = new Subscription();

    // Loading
    this.subscription.add(
      combineLatest([
        this.store.pipe(select(isLoadingAuthSelector)),
        this.store.pipe(select(isLoadingUserSelector)),
        this.store.pipe(select(isLoadingRoomSelector)),
      ]).subscribe(([isLoadingAuth, isLoadingUser, isLoadingRoom]) => {
        this.loadingController(isLoadingAuth || isLoadingUser || isLoadingRoom);
      })
    );

    // Present Toast if error
    this.subscription.add(
      this.store
        .pipe(select(blockUserErrorSelector))
        .subscribe((error: ErrorInterface) => {
          if (error) {
            this.presentToast(error.message, 'danger');
          }
        })
    );
    this.subscription.add(
      this.store
        .pipe(select(errorUserSelector))
        .subscribe((error: ErrorInterface) => {
          if (error) {
            this.presentToast(error.message, 'danger');
          }
        })
    );
    this.subscription.add(
      this.store
        .pipe(select(errorRoomSelector))
        .subscribe((error: ErrorInterface) => {
          if (error) {
            this.presentToast(error.message, 'danger');
          }
        })
    );

    // Present Toast if user has been blocked successfully
    this.subscription.add(
      this.store
        .pipe(select(blockUserSuccessSelector))
        .subscribe((success: boolean) => {
          if (success) {
            this.presentToast('The user has been blocked.', 'success');
            this.store.dispatch(blockUserInitialStateAction());
            this.router.navigate(['/home']);
          }
        })
    );

    // Present Toast if user has been reported successfully
    this.subscription.add(
      this.store.pipe(select(reportSelector)).subscribe((report) => {
        if (report) {
          this.presentToast(
            'The user has been reported but not blocked.',
            'success'
          );
          this.store.dispatch(reportUserInitialStateAction());
        }
      })
    );
  }

  ionViewWillLeave() {
    this.isLoadingOverlayActive
      .pipe(
        filter((isActive) => !isActive),
        take(1)
      )
      .subscribe(async () => {
        if (this.loadingOverlay) {
          await this.loadingOverlay.dismiss();
          this.loadingOverlay = undefined;
        }
      });

    // Unsubscribe from all subscriptions
    this.subscription.unsubscribe();
  }

  initValues() {
    this.userId = this.route.snapshot.paramMap.get('id') || null;
    this.user$ = this.store.pipe(select(userSelector));
    this.currentUser$ = this.store.pipe(select(currentUserSelector));

    this.rooms$ = this.store.pipe(select(roomsSelector));

    // Get User By userId
    this.store.dispatch(getUserByIdAction({ userId: this.userId }));

    // Set User
    this.user$.subscribe((user) => {
      this.studyLanguages = user?.languages.filter(
        (lang) => !lang.motherLanguage
      );
      this.motherLanguages = user?.languages.filter(
        (lang) => lang.motherLanguage
      );

      // Set readable gender
      if (user?.gender === 'other') {
        this.gender = 'Prefer Not To Say';
      } else {
        this.gender =
          user?.gender.charAt(0).toUpperCase() + user?.gender.slice(1);
      }

      this.profilePhoto = user?.profilePhoto;
      this.otherPhotos = user?.otherPhotos;
      this.badges = user?.badges.map(
        (badge) => `/assets/image/badges/${badge}.png`
      );
    });
  }

  async openPreview(photos) {
    console.log(photos);
    const modal = await this.modalCtrl.create({
      component: PreviewPhotoComponent,
      componentProps: {
        photos: photos,
      },
    });
    modal.present();
  }

  //
  // Report User
  //

  reportUser(reason: string) {
    if (!reason) {
      this.presentToast('Please enter a reason.', 'danger');
      return;
    }

    this.reportUserModal.dismiss();
    const request = { userId: this.userId, reason: reason };

    // Dispatch the action to update current user
    this.currentUser$
      .subscribe((currentUser) => {
        if (currentUser.$id === this.userId) {
          this.presentToast('You cannot block yourself.', 'danger');
        } else {
          const request = { userId: this.userId, reason: reason };
          // Dispatch the action to update current user
          this.store.dispatch(reportUserAction({ request }));
        }
      })
      .unsubscribe();
  }

  //
  // Block User
  //

  blockUser() {
    this.blockUserModal.dismiss();
    this.currentUser$
      .subscribe((currentUser) => {
        if (currentUser.blockedUsers.includes(this.userId)) {
          this.presentToast('User already blocked.', 'danger');
        } else if (currentUser.$id === this.userId) {
          this.presentToast('You cannot block yourself.', 'danger');
        } else {
          const request = { userId: this.userId };
          // Dispatch the action to update current user
          this.store.dispatch(blockUserAction({ request }));
        }
      })
      .unsubscribe();
  }

  async openTermsAndPolicyLink() {
    await Browser.open({ url: environment.web.TERMS_AND_CONDITIONS_URL });
  }

  //
  // Utils
  //

  lastSeen(d: any) {
    if (!d) return null;
    return lastSeen(d);
  }

  lastSeenExt(d: any) {
    if (!d) return null;
    return lastSeenExt(d);
  }

  getAge(d: any) {
    if (!d) return null;
    return getAge(d);
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

  //
  // Get or Create Room
  //

  getRoom() {
    let userId = this.userId;

    this.rooms$
      .subscribe((rooms) => {
        this.currentUser$
          .subscribe((user) => {
            const currentUserId = user.$id;
            if (rooms) {
              const room = rooms.find(
                (room) =>
                  room.users.includes(currentUserId) &&
                  room.users.includes(userId)
              );
              if (room) {
                this.store.dispatch(activateRoomAction({ payload: room }));
              } else {
                this.store.dispatch(getRoomAction({ currentUserId, userId }));
              }
            } else {
              this.store.dispatch(getRoomAction({ currentUserId, userId }));
            }
          })
          .unsubscribe();
      })
      .unsubscribe();
  }

  //
  // Loading Controller
  //

  private loadingOverlay: HTMLIonLoadingElement;
  private isLoadingOverlayActive = new BehaviorSubject<boolean>(false);
  async loadingController(isLoading: boolean) {
    if (isLoading) {
      if (!this.loadingOverlay) {
        this.isLoadingOverlayActive.next(true);
        this.loadingOverlay = await this.loadingCtrl.create({
          message: 'Please wait...',
        });
        await this.loadingOverlay.present();
        this.isLoadingOverlayActive.next(false);
      }
    } else if (this.loadingOverlay) {
      this.isLoadingOverlayActive.next(true);
      await this.loadingOverlay.dismiss();
      this.loadingOverlay = undefined;
      this.isLoadingOverlayActive.next(false);
    }
  }
}
