import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { Chat3PageRoutingModule } from './chat3-routing.module';

import { Chat3Page } from './chat3.page';
import { ComponentsModule } from 'src/app/components/components.module';
import { ChatBoxComponent } from 'src/app/components/chat-box/chat-box.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    Chat3PageRoutingModule,
    ComponentsModule
  ],
  declarations: [Chat3Page, ChatBoxComponent]
})
export class Chat3PageModule {}
