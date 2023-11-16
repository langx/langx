import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';

import { HomePageRoutingModule } from './home-routing.module';
import { HomePage } from './home.page';
import { ComponentsModule } from 'src/app/components/components.module';
import { userReducers } from 'src/app/store/reducers/user.reducer';
import { UserEffects } from 'src/app/store/effects/user.effect';
import { roomsReducers } from 'src/app/store/reducers/rooms.reducer';
import { RoomEffects } from 'src/app/store/effects/room.effect';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    HomePageRoutingModule,
    ComponentsModule,
    StoreModule.forFeature('user', userReducers),
    StoreModule.forFeature('rooms', roomsReducers),
    EffectsModule.forFeature([UserEffects, RoomEffects]),
  ],
  declarations: [HomePage],
})
export class HomePageModule {}
