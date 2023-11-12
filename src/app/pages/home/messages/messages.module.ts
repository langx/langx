import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';

import { MessagesPageRoutingModule } from './messages-routing.module';
import { MessagesPage } from './messages.page';
import { ComponentsModule } from 'src/app/components/components.module';
import { roomReducers } from 'src/app/store/reducers/room.reducer';
import { RoomEffects } from 'src/app/store/effects/room.effect';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MessagesPageRoutingModule,
    ComponentsModule,
    StoreModule.forFeature('room', roomReducers),
    EffectsModule.forFeature([RoomEffects]),
  ],
  declarations: [MessagesPage],
})
export class MessagesPageModule {}
