import { IonModal, ModalController } from '@ionic/angular';
import { Observable, forkJoin, of } from 'rxjs';
import { isEqual } from 'lodash';
import {
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  ViewChild,
} from '@angular/core';

import { UserService } from 'src/app/services/user/user.service';

import { PreviewPhotoComponent } from 'src/app/components/preview-photo/preview-photo.component';

@Component({
  selector: 'app-other-photos-card-for-user',
  templateUrl: './other-photos-card-for-user.component.html',
  styleUrls: ['./other-photos-card-for-user.component.scss'],
})
export class OtherPhotosCardForUserComponent implements OnInit, OnChanges {
  @Input() otherPics: string[];
  @ViewChild(IonModal) modal: IonModal;

  otherPics$: Observable<URL[]> = of([]);

  constructor(
    private userService: UserService,
    private modalCtrl: ModalController
  ) {}

  ngOnInit() {
    this.initOtherPics();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (
      changes['otherPics'] &&
      !isEqual(
        changes['otherPics'].currentValue,
        changes['otherPics'].previousValue
      )
    ) {
      this.initOtherPics();
    }
  }

  initOtherPics() {
    this.otherPics$ = forkJoin(
      (this.otherPics || []).map((id) => this.userService.getUserFileView(id))
    );
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
}
