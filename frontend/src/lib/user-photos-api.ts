import { authorizedGet, authorizedPost } from "@/lib/auth-session";

export interface UploadUserPhotoResponse {
  id: number;
  photoUrl: string;
}

export function uploadUserPhoto(
  userId: number,
  file: File,
): Promise<UploadUserPhotoResponse> {
  const body = new FormData();
  body.append("photo", file);

  return authorizedPost<UploadUserPhotoResponse>(
    `/users/${userId}/photo`,
    body,
  );
}

export function getUserPhoto(
  userId: number,
  signal?: AbortSignal,
): Promise<Blob> {
  return authorizedGet<Blob>(`/users/${userId}/photo`, signal, "blob");
}
