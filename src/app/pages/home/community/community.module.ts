import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';

import { CommunityPageRoutingModule } from './community-routing.module';
import { CommunityPage } from './community.page';
import { UserListComponent } from 'src/app/components/user-list/user-list.component';
import { userReducers } from 'src/app/store/reducers/user.reducer';
import { UserEffects } from 'src/app/store/effects/user.effect';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CommunityPageRoutingModule,
    StoreModule.forFeature('user', userReducers),
    EffectsModule.forFeature([UserEffects]),
  ],
  declarations: [CommunityPage, UserListComponent],
})
export class CommunityPageModule {}
