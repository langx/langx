import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TargetLanguagePage } from './target-language.page';

describe('TargetLanguagePage', () => {
  let component: TargetLanguagePage;
  let fixture: ComponentFixture<TargetLanguagePage>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(TargetLanguagePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
