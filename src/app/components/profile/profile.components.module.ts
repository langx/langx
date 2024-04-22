import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

// Profile Components
import { PpCardComponent } from './pp-card/pp-card.component';
import { OtherPhotosCardComponent } from './other-photos-card/other-photos-card.component';
import { AboutmeCardComponent } from './aboutme-card/aboutme-card.component';

// Pipes
import { AppExtrasModule } from '../../app.extras.module';

@NgModule({
  declarations: [PpCardComponent, AboutmeCardComponent],
  // declarations: [PpCardComponent, OtherPhotosCardComponent],
  imports: [CommonModule, IonicModule, AppExtrasModule],
  exports: [PpCardComponent, AboutmeCardComponent],
  // exports: [PpCardComponent, OtherPhotosCardComponent],
})
export class ProfileComponentsModule {}
