import { authorizedGet, authorizedPost } from "@/lib/auth-session";

export interface UploadPersonPhotoResponse {
  id: number;
  photoUrl: string;
}

export function uploadPersonPhoto(
  personId: number,
  file: File,
): Promise<UploadPersonPhotoResponse> {
  const body = new FormData();
  body.append("photo", file);

  return authorizedPost<UploadPersonPhotoResponse>(
    `/persons/${personId}/photo`,
    body,
  );
}

export function getPersonPhoto(
  personId: number,
  signal?: AbortSignal,
): Promise<Blob> {
  return authorizedGet<Blob>(`/persons/${personId}/photo`, signal, "blob");
}
