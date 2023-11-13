import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';

import { IonicModule } from '@ionic/angular';

import { ChatPageRoutingModule } from './chat-routing.module';

import { ChatPage } from './chat.page';
import { ComponentsModule } from 'src/app/components/components.module';
import { ChatBoxComponent } from 'src/app/components/chat-box/chat-box.component';
import { roomReducers } from 'src/app/store/reducers/room.reducer';
import { RoomEffects } from 'src/app/store/effects/room.effect';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ChatPageRoutingModule,
    ComponentsModule,
    StoreModule.forFeature('room', roomReducers),
    EffectsModule.forFeature([RoomEffects]),
  ],
  declarations: [ChatPage, ChatBoxComponent]
})
export class ChatPageModule {}
