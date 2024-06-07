import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';

import { IonicModule } from '@ionic/angular';

import { ProfilePageRoutingModule } from './profile-routing.module';

import { ProfilePage } from './profile.page';
import { OtherPhotosCardForProfileComponent } from 'src/app/components/profile/other-photos-card-for-profile/other-photos-card-for-profile.component';
import { ProfileComponentsModule } from 'src/app/components/profile/profile.components.module';
import { PreviewPhotoComponent } from 'src/app/components/preview-photo/preview-photo.component';
import { walletReducers } from 'src/app/store/reducers/wallet.reducer';
import { WalletEffects } from 'src/app/store/effects/wallet.effect';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ProfilePageRoutingModule,
    ProfileComponentsModule,
    StoreModule.forFeature('wallet', walletReducers),
    EffectsModule.forFeature([WalletEffects]),
  ],
  declarations: [
    ProfilePage,
    PreviewPhotoComponent,
    OtherPhotosCardForProfileComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ProfilePageModule {}
