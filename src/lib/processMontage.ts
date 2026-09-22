import { listEntries, setProjectMontage, getProject } from "./db";
import { concatClipsToGif } from "./ffmpegServer";
import { putFile, deleteFile, getFile } from "./blob";

export async function processMontage(projectId: string): Promise<void> {
  try {
    const entries = await listEntries(projectId);
    const ready = entries.filter((e) => e.status === "ready" && e.clipUrl);
    if (ready.length < 2) {
      await setProjectMontage(projectId, { montageStatus: "error" });
      return;
    }

    const clips = await Promise.all(ready.map((e) => getFile(e.clipUrl!)));

    const gif = await concatClipsToGif(clips);

    const project = await getProject(projectId);
    const oldUrl = project?.montageGifUrl ?? null;
    const url = await putFile(`montages/${projectId}-${Date.now()}.gif`, gif, "image/gif");

    await setProjectMontage(projectId, {
      montageStatus: "ready",
      montageGifUrl: url,
      montageUpdatedAt: Date.now(),
    });

    if (oldUrl && oldUrl !== url) await deleteFile(oldUrl).catch(() => {});
  } catch {
    await setProjectMontage(projectId, { montageStatus: "error" }).catch(() => {});
  }
}
