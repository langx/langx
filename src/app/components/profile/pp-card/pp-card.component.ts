import { IonModal, ModalController } from '@ionic/angular';
import { Observable } from 'rxjs';
import { isEqual } from 'lodash';
import {
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  ViewChild,
} from '@angular/core';

import {
  getAge,
  getFlagEmoji,
  lastSeen,
  lastSeenExt,
} from 'src/app/extras/utils';

import { User } from 'src/app/models/User';
import { UserService } from 'src/app/services/user/user.service';
import { PreviewPhotoComponent } from 'src/app/components/preview-photo/preview-photo.component';

@Component({
  selector: 'app-pp-card',
  templateUrl: './pp-card.component.html',
  styleUrls: ['./pp-card.component.scss'],
})
export class PpCardComponent implements OnInit, OnChanges {
  @Input() currentUser: User;
  @ViewChild(IonModal) modal: IonModal;

  profilePic$: Observable<URL> = null;
  gender: string;

  constructor(
    private userService: UserService,
    private modalCtrl: ModalController
  ) {}

  ngOnInit() {
    this.profilePic$ = this.userService.getUserFileView(
      this.currentUser?.profilePic
    );

    // Set others gender
    if (this.currentUser?.gender === 'other') {
      this.gender = 'Prefer Not To Say';
    } else {
      this.gender = this.currentUser?.gender;
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (
      changes['currentUser'] &&
      !isEqual(
        changes['currentUser'].currentValue?.profilePic,
        changes['currentUser'].previousValue?.profilePic
      )
    ) {
      // console.log('currentUser.profilePic has been changed');
      this.profilePic$ = this.userService.getUserFileView(
        this.currentUser?.profilePic
      );
    }
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

  dismissModal() {
    this.modal.dismiss();
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
}
