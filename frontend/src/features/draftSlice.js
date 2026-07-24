import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  draftId: null,
  fields: {},
  missingFields: [],
  riskAssessment: {
    severitySuggested: "",
    suggestedNextAction: "",
    initialRiskAssessment: "",
  },
  status: "pending_triage",
  chatMessages: [],
  sending: false,
};

const draftSlice = createSlice({
  name: "draft",
  initialState,
  reducers: {
    draftStarted(state, action) {
      state.draftId = action.payload.draftId;
    },
    chatTurnSending(state) {
      state.sending = true;
    },
    chatTurnReceived(state, action) {
      const { assistantMessage, fields, missingFields, riskAssessment, status, userMessage } =
        action.payload;
      if (userMessage) {
        state.chatMessages.push({ role: "user", content: userMessage });
      }
      state.chatMessages.push({ role: "assistant", content: assistantMessage });
      state.fields = fields;
      state.missingFields = missingFields;
      state.riskAssessment = riskAssessment;
      state.status = status;
      state.sending = false;
    },
    fieldEdited(state, action) {
      const { field, value } = action.payload;
      state.fields[field] = value;
    },
    riskAssessmentEdited(state, action) {
      const { field, value } = action.payload;
      state.riskAssessment[field] = value;
    },
    draftReset() {
      return initialState;
    },
  },
});

export const {
  draftStarted,
  chatTurnSending,
  chatTurnReceived,
  fieldEdited,
  riskAssessmentEdited,
  draftReset,
} = draftSlice.actions;

export default draftSlice.reducer;
