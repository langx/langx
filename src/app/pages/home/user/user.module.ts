import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { UserPageRoutingModule } from './user-routing.module';
import { UserPage } from './user.page';
import { ComponentsModule } from 'src/app/components/components.module';
import { ProfileComponentsModule } from 'src/app/components/profile/profile.components.module';
import { PreviewPhotoComponent } from 'src/app/components/preview-photo/preview-photo.component';
// import { OtherPhotosCardForProfileComponent } from 'src/app/components/profile/other-photos-card-for-profile/other-photos-card-for-profile.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    UserPageRoutingModule,
    ComponentsModule,
    ProfileComponentsModule,
  ],
  declarations: [UserPage, PreviewPhotoComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class UserPageModule {}
