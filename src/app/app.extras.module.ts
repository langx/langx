import { NgModule } from '@angular/core';

import { CustomFilterPipe } from 'src/app/extras/custom-filter.pipe';
import { DateMaskPipe } from 'src/app/extras/date-mask.pipe';

@NgModule({
  imports: [],
  declarations: [CustomFilterPipe, DateMaskPipe],
  exports: [CustomFilterPipe, DateMaskPipe],
})
export class AppExtrasModule {}
