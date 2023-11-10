import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';

import { CommunityPageRoutingModule } from './community-routing.module';
import { CommunityPage } from './community.page';
import { UserListComponent } from 'src/app/components/user-list/user-list.component';
import { communityReducers } from 'src/app/store/reducers/community.reducer';
import { CommunityEffects } from 'src/app/store/effects/community.effect';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CommunityPageRoutingModule,
    StoreModule.forFeature('community', communityReducers),
    EffectsModule.forFeature([CommunityEffects]),
  ],
  declarations: [CommunityPage, UserListComponent],
})
export class CommunityPageModule {}
