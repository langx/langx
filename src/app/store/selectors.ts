import { createFeatureSelector } from '@ngrx/store';

import { AuthStateInterface } from '../models/types/states/authState.interface';

export const authFeatureSelector = createFeatureSelector<AuthStateInterface>('auth');
