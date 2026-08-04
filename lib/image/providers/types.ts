export type ImageGenerateOptions = {
  prompt: string
  width: number
  height: number
  seed?: number
}

export type ImageProviderResult = {
  buffer: Buffer
  provider: string
  model?: string
}

export interface ImageProvider {
  name: string
  isAvailable(): boolean | Promise<boolean>
  generate(options: ImageGenerateOptions): Promise<ImageProviderResult>
}