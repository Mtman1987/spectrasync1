import path from "node:path"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"



export interface ConvertMp4ToGifOptions {
  /** Target width for the generated GIF. Defaults to 240 pixels. */
  width?: number
  /** Target height for the generated GIF. Defaults to 135 pixels. */
  height?: number
  /** Frames per second for the GIF animation. Defaults to 15 fps. */
  fps?: number
  /** Loop behaviour for the GIF. `0` = infinite loop. */
  loop?: number
  /** Optional explicit storage object path (within the bucket). */
  storagePath?: string
}

export interface ConvertMp4ToGifResult {
  /** Location of the GIF in Cloud Storage if uploaded. */
  storagePath: string | null
  /** Signed URL to access the GIF when one is generated. */
  downloadUrl: string | null
  /** Duration of the source clip in seconds, if provided by the API. */
  durationSeconds: number
  /** Additional metadata returned by the conversion API, if any. */
  metadata: Record<string, unknown> | null
  /** Raw GIF bytes for callers that need to stream or attach directly. */
  buffer: Buffer
}

const DEFAULT_WIDTH = 240
const DEFAULT_HEIGHT = 135
const DEFAULT_FPS = 15
const DEFAULT_LOOP = 0

async function ensureDirectoryForFile(filePath: string) {
  const directory = path.dirname(filePath)
  await mkdir(directory, { recursive: true })
}

function resolveShotstackConfig() {
  const baseUrl =
    process.env.SHOTSTACK_API_BASE_URL ??
    process.env.SHOTSTOCK_API_BASE_URL ??
    process.env.SHOTSTACK_API_URL ??
    null
  const apiKey =
    process.env.SHOTSTACK_API_KEY ??
    process.env.SHOTSTOCK_API_KEY ??
    process.env.SHOTSTACK_KEY ??
    null

  if (!baseUrl || !apiKey) {
    throw new Error('Shotstack API credentials are not configured. Set SHOTSTACK_API_BASE_URL and SHOTSTACK_API_KEY.')
  }

  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey }
}

async function requestShotstackConversion(payload: Record<string, unknown>) {
  const { baseUrl, apiKey } = resolveShotstackConfig()

  const response = await fetch(`${baseUrl}/convert/mp4-to-gif`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Shotstack API error ${response.status}: ${body}`)
  }

  return (await response.json()) as {
    gifBase64?: string
    durationSeconds?: number
    metadata?: Record<string, unknown>
  }
}

async function uploadToStorage(gifBuffer: Buffer, destinationPath: string): Promise<{ storagePath: string; downloadUrl: string | null }> {
  try {
    const { getAdminApp } = await import('@/lib/firebase-admin');
    const { getStorage } = await import('firebase-admin/storage');
    const app = await getAdminApp()
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET ?? app.options.storageBucket
    if (!bucketName) {
      throw new Error('No Firebase storage bucket configured')
    }

    const bucket = getStorage(app).bucket(bucketName)
    const file = bucket.file(destinationPath)
    await file.save(gifBuffer, {
      contentType: 'image/gif',
      resumable: false,
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    })

    let downloadUrl: string | null = null
    try {
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
      })
      downloadUrl = signedUrl ?? null
    } catch (signedUrlError) {
      console.warn('[convertVideoToGif] Failed to create signed URL for GIF.', signedUrlError)
    }

    return { storagePath: `${bucketName}/${destinationPath}`, downloadUrl }
  } catch (error) {
    console.warn('[convertVideoToGif] Falling back to local filesystem write � storage upload failed.', error)
    return { storagePath: '', downloadUrl: null }
  }
}

export async function convertMp4ToGif(
  inputPath: string,
  outputPath: string,
  options: ConvertMp4ToGifOptions = {},
): Promise<ConvertMp4ToGifResult> {
  const { width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT, fps = DEFAULT_FPS, loop = DEFAULT_LOOP, storagePath } = options

  const inputBuffer = await readFile(inputPath)

  const response = await requestShotstackConversion({
    input: inputBuffer.toString('base64'),
    inputFileName: path.basename(inputPath),
    outputFileName: path.basename(outputPath),
    options: { width, height, fps, loop },
  })

  if (!response.gifBase64) {
    throw new Error('Shotstack API response did not include a GIF payload.')
  }

  const gifBuffer = Buffer.from(response.gifBase64, 'base64')

  const desiredPath =
    storagePath ?? `generated-gifs/${new Date().getUTCFullYear()}/${new Date().getUTCMonth() + 1}/${randomUUID()}.gif`

  let storageUploadPath: string | null = null
  let downloadUrl: string | null = null

  const uploadResult = await uploadToStorage(gifBuffer, desiredPath)
  if (uploadResult.storagePath) {
    storageUploadPath = uploadResult.storagePath
    downloadUrl = uploadResult.downloadUrl
  } else {
    await ensureDirectoryForFile(outputPath)
    await writeFile(outputPath, gifBuffer)
    storageUploadPath = path.resolve(outputPath)
  }

  return {
    storagePath: storageUploadPath,
    downloadUrl,
    durationSeconds: response.durationSeconds ?? 0,
    metadata: response.metadata ?? null,
    buffer: gifBuffer,
  }
}
