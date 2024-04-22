import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ProfilePageRoutingModule } from './profile-routing.module';

import { ProfilePage } from './profile.page';
import { PreviewPhotoComponent } from 'src/app/components/preview-photo/preview-photo.component';
import { OtherPhotosCardComponent } from 'src/app/components/profile/other-photos-card/other-photos-card.component';
import { ProfileComponentsModule } from 'src/app/components/profile/profile.components.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ProfilePageRoutingModule,
    ProfileComponentsModule,
  ],
  // declarations: [ProfilePage, PreviewPhotoComponent],
  declarations: [ProfilePage, PreviewPhotoComponent, OtherPhotosCardComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ProfilePageModule {}
