import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { OtherPhotosCardForUserComponent } from './other-photos-card-for-user.component';

describe('OtherPhotosCardForUserComponent', () => {
  let component: OtherPhotosCardForUserComponent;
  let fixture: ComponentFixture<OtherPhotosCardForUserComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [OtherPhotosCardForUserComponent],
      imports: [IonicModule.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(OtherPhotosCardForUserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
