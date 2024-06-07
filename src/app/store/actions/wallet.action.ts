import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/wallet.actiontypes';
import { listWalletResponseInterface } from 'src/app/models/types/responses/listWalletResponse.interface';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

// Get Wallet Actions
export const getWalletAction = createAction(ActionTypes.GET_WALLET);

export const getWalletSuccessAction = createAction(
  ActionTypes.GET_WALLET_SUCCESS,
  props<{ payload: listWalletResponseInterface }>()
);

export const getWalletFailureAction = createAction(
  ActionTypes.GET_WALLET_FAILURE,
  props<{ error: ErrorInterface }>()
);
