import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

export async function createDraft() {
  const { data } = await api.post("/api/drafts");
  return data;
}

export async function sendChatTurn(draftId, { message, attachment }) {
  const formData = new FormData();
  if (message) formData.append("message", message);
  if (attachment) formData.append("attachment", attachment);

  const { data } = await api.post(`/api/drafts/${draftId}/chat`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function commitDraft(draftId) {
  const { data } = await api.post(`/api/drafts/${draftId}/commit`);
  return data;
}
