import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FcmTestPage } from './fcm-test.page';

describe('FcmTestPage', () => {
  let component: FcmTestPage;
  let fixture: ComponentFixture<FcmTestPage>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(FcmTestPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
