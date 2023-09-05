import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PreviewPhotoPage } from './preview-photo.page';

describe('PreviewPhotoPage', () => {
  let component: PreviewPhotoPage;
  let fixture: ComponentFixture<PreviewPhotoPage>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(PreviewPhotoPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});