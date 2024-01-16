import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProviderPage } from './provider.page';

describe('ProviderPage', () => {
  let component: ProviderPage;
  let fixture: ComponentFixture<ProviderPage>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(ProviderPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
