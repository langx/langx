import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

// Profile Components
import { PpCardComponent } from './pp-card/pp-card.component';
import { OtherPhotosCardComponent } from './other-photos-card/other-photos-card.component';

// Pipes
import { AppExtrasModule } from '../../app.extras.module';

@NgModule({
  declarations: [PpCardComponent],
  // declarations: [PpCardComponent, OtherPhotosCardComponent],
  imports: [CommonModule, IonicModule, AppExtrasModule],
  exports: [PpCardComponent],
  // exports: [PpCardComponent, OtherPhotosCardComponent],
})
export class ProfileComponentsModule {}
