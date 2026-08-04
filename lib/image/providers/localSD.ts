import type { ImageProvider, ImageGenerateOptions, ImageProviderResult } from './types'

// Set once a local Automatic1111 or ComfyUI instance is running, e.g.:
// LOCAL_SD_URL="http://127.0.0.1:7860"
const LOCAL_SD_URL = process.env.LOCAL_SD_URL

export const localSdProvider: ImageProvider = {
  name: 'local-sd',
  isAvailable() {
    return Boolean(LOCAL_SD_URL)
  },
  async generate(_options: ImageGenerateOptions): Promise<ImageProviderResult> {
    if (!LOCAL_SD_URL) {
      throw new Error('LOCAL_SD_URL not configured — local Stable Diffusion not set up yet')
    }
    // TODO: once a local SD instance runs, call its API here, e.g. Automatic1111's
    // POST {LOCAL_SD_URL}/sdapi/v1/txt2img with { prompt, width, height, seed }
    // and decode the base64 image from the response.
    throw new Error('local-sd provider not implemented yet')
  },
}