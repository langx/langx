import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { CommunityPageRoutingModule } from './community-routing.module';
import { CommunityPage } from './community.page';
import { UserListComponent } from 'src/app/components/user-list/user-list.component';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, CommunityPageRoutingModule],
  declarations: [CommunityPage, UserListComponent],
})
export class CommunityPageModule {}
