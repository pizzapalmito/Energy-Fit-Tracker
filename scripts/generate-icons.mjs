import sharp from 'sharp'
import { resolve } from 'node:path'

const source = resolve('assets/branding/eft-logo-source.jpg')

for (const size of [180, 192, 512]) {
  await sharp(source).resize(size, size).png().toFile(resolve(`public/icons/icon-${size}.png`))
}

await sharp(source).resize(32, 32).png().toFile(resolve('public/icons/favicon-32.png'))

await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } })
  .composite([{ input: await sharp(source).resize(384, 384).png().toBuffer(), left: 64, top: 64 }])
  .png()
  .toFile(resolve('public/icons/icon-maskable-512.png'))

await sharp(source)
  .extract({ left: 20, top: 220, width: 1220, height: 800 })
  .webp({ quality: 88 })
  .toFile(resolve('public/brand/eft-logo.webp'))

console.log('Generated Energy Fit Tracker icons: favicon-32, icon-180, icon-192, icon-512, icon-maskable-512, brand/eft-logo.webp')
