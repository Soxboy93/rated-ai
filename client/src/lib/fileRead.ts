/** Reads a teacher's upload into something the server can take: plain text stays text, a photo is shrunk, a PDF is sent as is. */
export type PickedFile = { kind: "text"; text: string } | { kind: "binary"; data: string; mimeType: "image/jpeg" | "application/pdf" };

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_SIDE = 2000;

async function imageToJpeg(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
}

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

/** Throws an Error with a message safe to show (and translate) when the file cannot be used. */
export async function pickFile(file: File): Promise<PickedFile> {
  const name = file.name.toLowerCase();
  if (file.type.startsWith("image/")) return { kind: "binary", data: await imageToJpeg(file), mimeType: "image/jpeg" };
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("That file is too big. Please use one under 5 MB.");
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return { kind: "binary", data: await fileToBase64(file), mimeType: "application/pdf" };
  if (file.type.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md")) return { kind: "text", text: await file.text() };
  throw new Error("Please choose a photo, a PDF or a text file.");
}
