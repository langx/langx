import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Store, select } from '@ngrx/store';
import { Browser } from '@capacitor/browser';
import { IonModal, ModalController, ToastController } from '@ionic/angular';
import { Observable, Subscription, combineLatest, forkJoin, of } from 'rxjs';

// Component and utils Imports
import {
  getAge,
  getFlagEmoji,
  lastSeen,
  lastSeenExt,
} from 'src/app/extras/utils';
import { environment } from 'src/environments/environment';
import { PreviewPhotoComponent } from 'src/app/components/preview-photo/preview-photo.component';

// Interfaces Imports
import { Language } from 'src/app/models/Language';
import { User } from 'src/app/models/User';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { RoomExtendedInterface } from 'src/app/models/types/roomExtended.interface';

// Services Imports
import { UserService } from 'src/app/services/user/user.service';

// Actions Imports
import { activateRoomAction } from 'src/app/store/actions/message.action';
import {
  getRoomAction,
  clearErrorsAction,
} from 'src/app/store/actions/room.action';
import {
  getUserByIdAction,
  reportUserAction,
  reportUserInitialStateAction,
  blockUserAction,
  blockUserInitialStateAction,
} from 'src/app/store/actions/user.action';

// Selectors Imports
import { roomsSelector } from 'src/app/store/selectors/room.selector';
import {
  isLoadingSelector as isLoadingRoomSelector,
  errorSelector as errorRoomSelector,
} from 'src/app/store/selectors/room.selector';
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

  isLoading: boolean;

  subscription: Subscription;

  userId: string;
  user$: Observable<User>;
  currentUser$: Observable<User>;

  studyLanguages: Language[] = [];
  motherLanguages: Language[] = [];
  gender: string = null;
  profilePic$: Observable<URL> = null;
  otherPics$: Observable<URL[]> = of([]);
  badges: Object[] = [];

  reason: string;

  rooms$: Observable<RoomExtendedInterface[] | null> = null;

  constructor(
    private store: Store,
    private router: Router,
    private userService: UserService,
    private route: ActivatedRoute,
    private modalCtrl: ModalController,
    private toastController: ToastController
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
        this.isLoading = isLoadingAuth || isLoadingUser || isLoadingRoom;
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
            this.store.dispatch(clearErrorsAction());
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

      this.profilePic$ = this.userService.getUserFileView(user?.profilePic);
      this.otherPics$ = forkJoin(
        (user?.otherPics || []).map((id) =>
          this.userService.getUserFileView(id)
        )
      );

      this.badges = user?.badges.map((badge) => {
        const name = badge
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        return { name: name, url: `/assets/image/badges/${badge}.png` };
      });
    });
  }

  async openPreview(photos$: Observable<URL | URL[]>): Promise<void> {
    photos$.subscribe(async (photos) => {
      const modal = await this.modalCtrl.create({
        component: PreviewPhotoComponent,
        componentProps: {
          photos: Array.isArray(photos) ? photos : [photos],
        },
      });
      modal.present();
    });
  }

  //
  // Report User
  //

  async openReportUserModal() {
    try {
      await this.reportUserModal.present();
    } catch (error) {
      console.error('Error opening report user modal:', error);
    }
  }

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
          this.presentToast('You cannot report yourself.', 'danger');
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

  async openBlockUserModal() {
    try {
      await this.blockUserModal.present();
    } catch (error) {
      console.error('Error opening block user modal:', error);
    }
  }

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
    await Browser.open({ url: environment.ext.TERMS_AND_CONDITIONS_URL });
  }

  //
  // Day Streaks
  //

  openLeaderboard() {
    this.router.navigate(['/', 'home', 'leaderboard']);
    console.log('Open Leaderboard');
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

  getFlagEmoji(item: User) {
    return getFlagEmoji(item);
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

            if (currentUserId === userId) {
              this.presentToast(
                "You can't send a message to yourself.",
                'danger'
              );
              return;
            }

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
  // Present Toast
  //

  async presentToast(msg: string, color?: string) {
    const toast = await this.toastController.create({
      message: msg,
      color: color || 'primary',
      duration: 1000,
      position: 'top',
    });

    await toast.present();
  }
}
