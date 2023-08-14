import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Step3Page } from './step3.page';

describe('Step3Page', () => {
  let component: Step3Page;
  let fixture: ComponentFixture<Step3Page>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(Step3Page);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
