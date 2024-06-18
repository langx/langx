import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/wallet.actiontypes';
import { listWalletsResponseInterface } from 'src/app/models/types/responses/listWalletsResponse.interface';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

// Get Wallet Actions
export const getWalletAction = createAction(ActionTypes.GET_WALLET);

export const getWalletSuccessAction = createAction(
  ActionTypes.GET_WALLET_SUCCESS,
  props<{ payload: listWalletsResponseInterface }>()
);

export const getWalletFailureAction = createAction(
  ActionTypes.GET_WALLET_FAILURE,
  props<{ error: ErrorInterface }>()
);

// List Wallets Actions
export const listWalletsAction = createAction(ActionTypes.LIST_WALLETS);

export const listWalletsSuccessAction = createAction(
  ActionTypes.LIST_WALLETS_SUCCESS,
  props<{ payload: listWalletsResponseInterface }>()
);

export const listWalletsFailureAction = createAction(
  ActionTypes.LIST_WALLETS_FAILURE,
  props<{ error: ErrorInterface }>()
);

// Clear Errors Action
export const clearErrorsAction = createAction(ActionTypes.CLEAR_ERRORS);
