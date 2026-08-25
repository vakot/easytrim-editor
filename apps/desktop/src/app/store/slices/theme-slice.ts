import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { type RootState } from "../store";
import {
  DEFAULT_CUSTOM_PRIMARY_COLOR,
  DEFAULT_PRIMARY_COLOR,
  isCustomPrimaryColor,
  type CustomPrimaryColor,
  type PrimaryColor,
  type PrimaryColorKey,
  type ThemePreference,
} from "@/app/theme/theme";

export interface ThemeState {
  preference: ThemePreference;
  primaryColor: PrimaryColor;
  customPrimaryColor: CustomPrimaryColor;
}

const createInitialState = (): ThemeState => ({
  preference: "system",
  primaryColor: DEFAULT_PRIMARY_COLOR,
  customPrimaryColor: DEFAULT_CUSTOM_PRIMARY_COLOR,
});

const themeSlice = createSlice({
  name: "theme",
  initialState: createInitialState,
  reducers: {
    themePreferenceChanged: (state, action: PayloadAction<ThemePreference>) => {
      state.preference = action.payload;
    },
    primaryColorChanged: (state, action: PayloadAction<PrimaryColor>) => {
      state.primaryColor = action.payload;
      if (isCustomPrimaryColor(action.payload)) {
        state.customPrimaryColor = action.payload;
      }
    },
    customPrimaryColorChanged: (state, action: PayloadAction<CustomPrimaryColor>) => {
      state.customPrimaryColor = action.payload;
      state.primaryColor = action.payload;
    },
  },
});

export const { themePreferenceChanged, primaryColorChanged, customPrimaryColorChanged } =
  themeSlice.actions;
export const themeReducer = themeSlice.reducer;

export const selectThemePreference = (state: RootState): ThemePreference =>
  state.theme.preference;
export const selectPrimaryColor = (state: RootState): PrimaryColor =>
  state.theme.primaryColor;
export const selectPrimaryColorKey = (state: RootState): PrimaryColorKey => {
  const primaryColor = selectPrimaryColor(state);
  return isCustomPrimaryColor(primaryColor) ? "custom" : primaryColor;
};
export const selectCustomPrimaryColor = (state: RootState): CustomPrimaryColor =>
  state.theme.customPrimaryColor;
