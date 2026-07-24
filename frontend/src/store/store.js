import { configureStore } from "@reduxjs/toolkit";

import draftReducer from "../features/draftSlice";

export const store = configureStore({
  reducer: {
    draft: draftReducer,
  },
});
