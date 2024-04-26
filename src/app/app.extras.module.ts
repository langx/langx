import { NgModule } from '@angular/core';

import { CustomFilterPipe } from 'src/app/extras/custom-filter.pipe';
import { DateMaskPipe } from 'src/app/extras/date-mask.pipe';
import { CapitalizeFirstPipe } from 'src/app/extras/capitalizeFirst';

@NgModule({
  imports: [],
  declarations: [CustomFilterPipe, DateMaskPipe, CapitalizeFirstPipe],
  exports: [CustomFilterPipe, DateMaskPipe, CapitalizeFirstPipe],
})
export class AppExtrasModule {}
