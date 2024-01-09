import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ArchivePage } from './archive.page';

const routes: Routes = [
  {
    path: '',
    component: ArchivePage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ArchivePageRoutingModule {}
