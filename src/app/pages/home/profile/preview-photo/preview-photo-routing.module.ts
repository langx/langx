import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { PreviewPhotoPage } from './preview-photo.page';

const routes: Routes = [
  {
    path: '',
    component: PreviewPhotoPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PreviewPhotoPageRoutingModule {}