import { IonModal, ModalController } from '@ionic/angular';
import { Observable } from 'rxjs';
import { isEqual } from 'lodash';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
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
  @Input() user: User;
  @Input() isLoading?: boolean;
  @Input() msgButton?: boolean;
  @Output() onClick?: EventEmitter<any> = new EventEmitter();

  @ViewChild(IonModal) modal: IonModal;

  profilePic$: Observable<URL> = null;
  gender: string;

  constructor(
    private userService: UserService,
    private modalCtrl: ModalController
  ) {}

  ngOnInit() {
    this.profilePic$ = this.userService.getUserFileView(this.user?.profilePic);

    // Set others gender
    if (this.user?.gender === 'other') {
      this.gender = 'Prefer Not To Say';
    } else {
      this.gender = this.user?.gender;
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (
      changes['user'] &&
      !isEqual(
        changes['user'].currentValue?.profilePic,
        changes['user'].previousValue?.profilePic
      )
    ) {
      // console.log('currentUser.profilePic has been changed');
      this.profilePic$ = this.userService.getUserFileView(
        this.user?.profilePic
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
  getRoom() {
    this.onClick.emit();
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
