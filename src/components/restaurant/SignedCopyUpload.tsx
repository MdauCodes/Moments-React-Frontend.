// Uploading the signed copy of a PO (owner, 16 Nov; doc 15 §20-§21): download the PO, the heads sign
// it on paper, then a scan or phone photos go up here. Phones get "Take photos" (the camera) as well
// as "Choose files". The store checks who may upload, the stage, the types and the sizes again.
import { useEffect, useRef, useState } from "react";
import { Camera, Download, FileText, Paperclip, Trash2, Upload } from "lucide-react";

import { ErrorText, Field, Muted, PortalButton, portalColors as c } from "./portalUi";
import { restaurantApi, type PoDetail, type SignedCopy } from "@/services/restaurantApi";
import {
  SIGNED_COPY_MAX_FILES,
  fileSize,
  signRuleText,
  signedCopyProblem,
} from "@/lib/restaurantPortal";

const ACCEPT = "application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png";

export function SignedCopyUpload({
  po,
  onUploaded,
}: {
  po: PoDetail;
  onUploaded: (copy: SignedCopy) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const mustSign = po.heads.filter((h) => h.mustSign);

  function add(list: FileList | null) {
    if (!list) return;
    const next = [...files, ...Array.from(list)].slice(0, SIGNED_COPY_MAX_FILES + 1);
    setFiles(next);
    setError(signedCopyProblem(next));
  }

  async function download() {
    setDownloading(true);
    setError(null);
    try {
      await restaurantApi.downloadPo(po.orderId, po.poNumber);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't download the purchase order.");
    } finally {
      setDownloading(false);
    }
  }

  async function upload() {
    const problem = signedCopyProblem(files);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      const copy = await restaurantApi.uploadSignedCopy(
        po.orderId,
        files,
        note.trim() || undefined,
      );
      setFiles([]);
      setNote("");
      onUploaded(copy);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload the signed copy.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="h-sign"
      className="rounded-[14px] border-2 bg-white p-4"
      style={{ borderColor: c.gold }}
    >
      <h2 id="h-sign" className="text-[18px] font-bold">
        {po.stage === "SENT_BACK" ? "Upload a new signed copy" : "Sign and upload"}
      </h2>
      {po.stage === "SENT_BACK" && po.sentBackReason && (
        <p
          role="alert"
          className="mt-2 rounded-[10px] p-3 text-[14px]"
          style={{ background: "#FBE7E3", color: "#8A2A1C" }}
        >
          <strong>Moments sent it back:</strong> {po.sentBackReason}
        </p>
      )}
      <ol className="mt-3 flex flex-col gap-3 text-[14.5px]">
        <li className="flex gap-3">
          <Step n={1} />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Download and print the PO</div>
            <PortalButton
              variant="secondary"
              className="mt-2"
              onClick={() => void download()}
              disabled={downloading}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {downloading ? "Downloading…" : `Download ${po.poNumber}`}
            </PortalButton>
          </div>
        </li>
        <li className="flex gap-3">
          <Step n={2} />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{signRuleText(po.approvalRule, mustSign.length)}</div>
            {mustSign.length > 0 && (
              <Muted>
                {mustSign.map((h) => `${h.name}${h.rank ? ` (${h.rank})` : ""}`).join(", ")}
              </Muted>
            )}
          </div>
        </li>
        <li className="flex gap-3">
          <Step n={3} />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Upload the signed copy</div>
            <Muted>
              A scan (PDF) or clear photos of every page. PDF, JPG or PNG, up to 10 MB each, up to{" "}
              {SIGNED_COPY_MAX_FILES} files.
            </Muted>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <PortalButton variant="secondary" onClick={() => cameraRef.current?.click()}>
                <Camera className="h-4 w-4" aria-hidden="true" /> Take photos
              </PortalButton>
              <PortalButton variant="secondary" onClick={() => filesRef.current?.click()}>
                <Paperclip className="h-4 w-4" aria-hidden="true" /> Choose files
              </PortalButton>
            </div>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                add(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              ref={filesRef}
              type="file"
              accept={ACCEPT}
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                add(e.target.files);
                e.target.value = "";
              }}
            />
            {files.length > 0 && (
              <ul className="mt-3 flex flex-col gap-2" aria-label="Files to upload">
                {files.map((f, i) => (
                  <FileRow
                    key={`${f.name}-${i}`}
                    file={f}
                    page={i + 1}
                    onRemove={() => {
                      const next = files.filter((_, j) => j !== i);
                      setFiles(next);
                      setError(next.length ? signedCopyProblem(next) : null);
                    }}
                  />
                ))}
              </ul>
            )}
            <Field
              className="mt-3"
              label="Note for Moments (optional)"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </li>
      </ol>
      <div className="mt-3">
        <ErrorText>{error}</ErrorText>
      </div>
      <PortalButton
        className="mt-3 w-full min-h-[52px] text-[16px]"
        onClick={() => void upload()}
        disabled={busy || files.length === 0}
      >
        <Upload className="h-4 w-4" aria-hidden="true" />
        {busy ? "Uploading…" : `Upload the signed copy${files.length ? ` (${files.length})` : ""}`}
      </PortalButton>
    </section>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white"
      style={{ background: c.green }}
    >
      {n}
    </span>
  );
}

function FileRow({ file, page, onRemove }: { file: File; page: number; onRemove: () => void }) {
  const [thumb, setThumb] = useState<string | null>(null);
  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setThumb(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <li
      className="flex list-none items-center gap-3 rounded-[10px] border p-2"
      style={{ borderColor: c.line, background: c.page }}
    >
      {thumb ? (
        <img src={thumb} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
      ) : (
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-md"
          style={{ background: c.soft }}
        >
          <FileText className="h-5 w-5" style={{ color: c.muted }} aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold">{file.name}</div>
        <div className="text-[12.5px]" style={{ color: c.muted }}>
          Page {page} · {fileSize(file.size)}
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px]"
        aria-label={`Remove ${file.name}`}
        style={{ color: c.danger }}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </li>
  );
}
