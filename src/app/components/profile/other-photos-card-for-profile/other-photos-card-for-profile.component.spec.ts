import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { OtherPhotosCardForProfileComponent } from './other-photos-card-for-profile.component';

describe('OtherPhotosCardForProfileComponent', () => {
  let component: OtherPhotosCardForProfileComponent;
  let fixture: ComponentFixture<OtherPhotosCardForProfileComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [OtherPhotosCardForProfileComponent],
      imports: [IonicModule.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(OtherPhotosCardForProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
