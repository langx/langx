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
import { roomReducers } from 'src/app/store/reducers/room.reducer';
import { UserEffects } from 'src/app/store/effects/user.effect';
import { UsersEffects } from 'src/app/store/effects/users.effect';
import { RoomEffects } from 'src/app/store/effects/room.effect';
import { RoomsEffects } from 'src/app/store/effects/rooms.effect';
import { LanguageEffects } from 'src/app/store/effects/language.effect';
import { PresenceEffects } from 'src/app/store/effects/presence.effect';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    HomePageRoutingModule,
    ComponentsModule,
    StoreModule.forFeature('user', userReducers),
    StoreModule.forFeature('room', roomReducers),
    EffectsModule.forFeature([
      UserEffects,
      UsersEffects,
      RoomEffects,
      RoomsEffects,
      LanguageEffects,
      PresenceEffects,
    ]),
  ],
  declarations: [HomePage],
})
export class HomePageModule {}
