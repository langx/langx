import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Step1Page } from './step1.page';

describe('Step1Page', () => {
  let component: Step1Page;
  let fixture: ComponentFixture<Step1Page>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(Step1Page);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
