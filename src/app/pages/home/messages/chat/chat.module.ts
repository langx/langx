import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { IonicModule } from '@ionic/angular';

import { ChatPageRoutingModule } from './chat-routing.module';
import { ChatPage } from './chat.page';
import { ComponentsModule } from 'src/app/components/components.module';
import { ChatBoxComponent } from 'src/app/components/chat-box/chat-box.component';
import { messageReducers } from 'src/app/store/reducers/message.reducer';
import { MessageEffects } from 'src/app/store/effects/message.effect';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    ChatPageRoutingModule,
    ComponentsModule,
    StoreModule.forFeature('message', messageReducers),
    EffectsModule.forFeature([MessageEffects]),
  ],
  declarations: [ChatPage, ChatBoxComponent],
})
export class ChatPageModule {}
