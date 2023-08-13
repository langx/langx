import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LanguagePage } from './language.page';

describe('LanguagePage', () => {
  let component: LanguagePage;
  let fixture: ComponentFixture<LanguagePage>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(LanguagePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
