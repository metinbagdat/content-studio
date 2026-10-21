import { afterEach, describe, expect, it } from 'vitest'
import { publicMediaAudioUrl, blobAudioUploadEnabled } from './audioStorage'

describe('publicMediaAudioUrl', () => {
  const prev = process.env.NEXT_PUBLIC_APP_URL

  afterEach(() => {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL
    else process.env.NEXT_PUBLIC_APP_URL = prev
  })

  it('uses NEXT_PUBLIC_APP_URL without trailing slash', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://studio.example.com/'
    expect(publicMediaAudioUrl('abc')).toBe('https://studio.example.com/api/media/abc/file')
  })

  it('falls back to localhost:3100', () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    expect(publicMediaAudioUrl('xyz')).toBe('http://localhost:3100/api/media/xyz/file')
  })
})

describe('blobAudioUploadEnabled', () => {
  const prevToken = process.env.BLOB_READ_WRITE_TOKEN
  const prevVercel = process.env.VERCEL

  afterEach(() => {
    if (prevToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN
    else process.env.BLOB_READ_WRITE_TOKEN = prevToken
    if (prevVercel === undefined) delete process.env.VERCEL
    else process.env.VERCEL = prevVercel
  })

  it('is true when BLOB_READ_WRITE_TOKEN is set', () => {
    delete process.env.VERCEL
    process.env.BLOB_READ_WRITE_TOKEN = 'tok'
    expect(blobAudioUploadEnabled()).toBe(true)
  })

  it('is true on Vercel even without token', () => {
    delete process.env.BLOB_READ_WRITE_TOKEN
    process.env.VERCEL = '1'
    expect(blobAudioUploadEnabled()).toBe(true)
  })

  it('is false locally without token', () => {
    delete process.env.BLOB_READ_WRITE_TOKEN
    delete process.env.VERCEL
    delete process.env.VERCEL_ENV
    delete process.env.AWS_LAMBDA_FUNCTION_NAME
    delete process.env.AWS_EXECUTION_ENV
    expect(blobAudioUploadEnabled()).toBe(false)
  })
})
