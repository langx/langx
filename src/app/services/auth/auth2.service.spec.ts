import { TestBed } from '@angular/core/testing';

import { Auth2Service } from './auth2.service';

describe('Auth2Service', () => {
  let service: Auth2Service;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Auth2Service);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
